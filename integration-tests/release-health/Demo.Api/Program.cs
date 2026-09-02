using System.Diagnostics;
using System.Diagnostics.Metrics;
using FeatBit.Sdk.Server;
using FeatBit.Sdk.Server.Model;
using FeatBit.Sdk.Server.Options;
using OpenTelemetry.Metrics;
using OpenTelemetry.Resources;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddOpenTelemetry().ConfigureResource(r => r.AddService("release-health-checkout"))
    .WithMetrics(m => m.AddMeter("ReleaseHealth.Checkout")
        .AddView("checkout_request_duration", new ExplicitBucketHistogramConfiguration
        { Boundaries = [0.025, 0.05, 0.1, 0.2, 0.4, 0.8, 1.6, 3.2] }).AddOtlpExporter());
var app = builder.Build();
using var meter = new Meter("ReleaseHealth.Checkout", "1.0.0");
var requests = meter.CreateCounter<long>("checkout_requests", "{request}");
var duration = meter.CreateHistogram<double>("checkout_request_duration", "s");
var scenario = "healthy";
long sequence = 0;
FbClient? flags = null;
var sdkSecret = builder.Configuration["FeatBit:EnvSecret"];
if (!string.IsNullOrWhiteSpace(sdkSecret))
{
    flags = new FbClient(new FbOptionsBuilder(sdkSecret)
        .Event(new Uri(builder.Configuration["FeatBit:EventUrl"] ?? "http://host.docker.internal:5100"))
        .Streaming(new Uri(builder.Configuration["FeatBit:StreamingUrl"] ?? "ws://host.docker.internal:5100"))
        .StartWaitTime(TimeSpan.FromSeconds(10)).Build());
}
var user = FbUser.Builder("release-health-demo").Build();
app.MapGet("/health", () => Results.Ok(new { status = "ok", scenario = Volatile.Read(ref scenario), sdkInitialized = flags?.Initialized ?? false }));
app.MapPost("/scenario/{mode}", (string mode) =>
{
    if (mode is not ("healthy" or "regression" or "recovery" or "flag")) return Results.BadRequest();
    if (mode == "flag" && flags?.Initialized != true)
        return Results.Problem("Configure the local FeatBit SDK before selecting flag mode.", statusCode: 409);
    Volatile.Write(ref scenario, mode);
    return Results.Ok(new { scenario = mode, changedAt = DateTimeOffset.UtcNow });
});
app.MapGet("/checkout", async (CancellationToken ct) =>
{
    var current = Volatile.Read(ref scenario);
    var bad = current == "regression" || (current == "flag" && flags!.BoolVariation(
        builder.Configuration["FeatBit:FlagKey"] ?? "release-health-regression", user, false));
    var number = Interlocked.Increment(ref sequence);
    var failed = bad && number % 4 == 0;
    var started = Stopwatch.GetTimestamp();
    await Task.Delay(bad ? 400 + (int)(number % 5) * 30 : 20 + (int)(number % 5) * 5, ct);
    // Deliberately bounded labels: no user IDs, request IDs or changing scenario label.
    var labels = new TagList { { "service", "checkout" }, { "environment", "demo" }, { "status", failed ? "500" : "200" } };
    requests.Add(1, labels);
    duration.Record(Stopwatch.GetElapsedTime(started).TotalSeconds, labels);
    return Results.Json(new { version = bad ? "regression" : "stable" }, statusCode: failed ? 500 : 200);
});
try { await app.RunAsync(); }
finally { if (flags is not null) await flags.CloseAsync(); }
