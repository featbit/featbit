using System.Diagnostics;
using System.Text;
using Api.Authentication;
using Domain.Secrets;
using Domain.Shared;
using Infrastructure.Fakes;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ApplicationModels;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

// An in-process HTTP comparison, not a Redis/database or network benchmark.
var concurrency = int.Parse(Environment.GetEnvironmentVariable("CONCURRENCY") ?? "32");
var seconds = int.Parse(Environment.GetEnvironmentVariable("DURATION_SECONDS") ?? "12");
var delayMs = int.Parse(Environment.GetEnvironmentVariable("STORE_DELAY_MS") ?? "2");
if (concurrency < 1 || seconds < 1 || delayMs < 0)
    throw new ArgumentOutOfRangeException(nameof(args), "Concurrency/duration must be positive; delay must be nonnegative");
Console.WriteLine($"Concurrency={concurrency}, duration={seconds}s, simulated store delay={delayMs}ms");
foreach (var cached in new[] { false, true })
{
    var store = new DelayedStore(delayMs);
    using var host = new WebApplicationFactory<SecretAuthenticationHandler>().WithWebHostBuilder(builder =>
    {
        builder.UseContentRoot(Path.GetFullPath("../../../../../src/Api", AppContext.BaseDirectory));
        builder.UseSetting("DbProvider", "Fake");
        builder.UseSetting("CacheProvider", "None");
        builder.UseSetting("MqProvider", "None");
        builder.UseSetting("Logging:MinimumLevel:Default", "Fatal");
        builder.ConfigureTestServices(services =>
        {
            services.Replace(ServiceDescriptor.Singleton<IStore>(store));
            if (!cached) services.Configure<MvcOptions>(options => options.Conventions.Add(new DisableCache()));
        });
    });
    using var client = host.CreateClient();
    client.DefaultRequestHeaders.Add("Authorization", DelayedStore.Token);

    async Task SendAsync()
    {
        using var body = new StringContent(
            """[{"user":{"keyId":"benchmark-user"},"metrics":[{"type":"Custom","eventName":"purchase","numericValue":1}]}]""",
            Encoding.UTF8, "application/json");
        using var response = await client.PostAsync("/api/public/insight/track", body);
        response.EnsureSuccessStatusCode();
    }

    for (var i = 0; i < 100; i++) await SendAsync();
    if (store.Queries != (cached ? 1 : 100)) throw new InvalidOperationException("Cache mode was not applied");
    store.Queries = 0;

    var run = Stopwatch.StartNew();
    var workers = Enumerable.Range(0, concurrency).Select(async _ =>
    {
        var samples = new List<double>();
        while (run.Elapsed.TotalSeconds < seconds)
        {
            var started = Stopwatch.GetTimestamp();
            await SendAsync();
            samples.Add(Stopwatch.GetElapsedTime(started).TotalMilliseconds);
        }
        return samples;
    }).ToArray();
    var results = await Task.WhenAll(workers);
    run.Stop();
    var latencies = results.SelectMany(x => x).Order().ToArray();
    Console.WriteLine($"{(cached ? "cached" : "baseline")}: requests={latencies.Length}, " +
                      $"rps={latencies.Length / run.Elapsed.TotalSeconds:F0}, " +
                      $"p50={latencies[(int)(latencies.Length * .50)]:F3}ms, " +
                      $"p95={latencies[(int)(latencies.Length * .95)]:F3}ms, " +
                      $"p99={latencies[(int)(latencies.Length * .99)]:F3}ms, storeQueries={store.Queries}");
}

sealed class DisableCache : IApplicationModelConvention
{
    public void Apply(ApplicationModel application)
    {
        foreach (var selector in application.Controllers.SelectMany(c => c.Actions).SelectMany(a => a.Selectors))
        {
            foreach (var marker in selector.EndpointMetadata.OfType<CacheSecretAuthenticationAttribute>().ToArray())
                selector.EndpointMetadata.Remove(marker);
        }
    }
}

sealed class DelayedStore(int delayMs) : FakeStore, IStore
{
    private static readonly Guid EnvId = Guid.NewGuid();
    public static readonly string Token = GuidHelper.Encode(Guid.NewGuid()) + GuidHelper.Encode(EnvId);
    public long Queries;

    async Task<Secret?> IStore.GetSecretAsync(string secretString)
    {
        Interlocked.Increment(ref Queries);
        if (delayMs > 0) await Task.Delay(delayMs);
        return secretString == Token ? new Secret(SecretTypes.Server, "benchmark", EnvId, "benchmark") : null;
    }
}
