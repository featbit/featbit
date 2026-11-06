using System.Net;
using System.Net.Http.Json;
using Domain.Secrets;
using Domain.Shared;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Internal;
using Streaming.Connections;

namespace Application.IntegrationTests.Http;

[Collection(nameof(TestApp))]
public class SecretCacheTests(TestApp app)
{
    [Fact]
    public async Task HttpAndStreaming_ShareCache()
    {
        var store = new Mock<IStore>();
        store.Setup(x => x.GetSecretAsync(TestData.ServerSecretString)).ReturnsAsync(TestData.ServerSecret);
        store.Setup(x => x.GetFlagsAsync(TestData.ServerEnvId, 0)).ReturnsAsync(Array.Empty<byte[]>());
        store.Setup(x => x.GetSegmentsAsync(TestData.ServerEnvId, 0)).ReturnsAsync(Array.Empty<byte[]>());
        using var host = app.WithWebHostBuilder(builder => builder.ConfigureTestServices(services =>
        {
            services.Replace(ServiceDescriptor.Singleton(store.Object));
            services.Replace(ServiceDescriptor.Singleton<ISystemClock>(new TestClock(TestData.ServerToken.Timestamp)));
        }));
        using var client = host.CreateClient();
        client.DefaultRequestHeaders.Add("Authorization", TestData.ServerSecretString);
        using var track = await TrackAsync(client);
        using var sync = await client.GetAsync("/api/public/sdk/server/latest-all");
        Assert.Equal(HttpStatusCode.OK, track.StatusCode);
        Assert.Equal(HttpStatusCode.OK, sync.StatusCode);

        var validator = host.Services.GetRequiredService<IRequestValidator>();
        var context = new DefaultHttpContext();
        context.Request.QueryString = new QueryString($"?type=server&version=2&token={TestData.ServerTokenString}");
        Assert.Equal(ValidationResultStatus.Valid, (await validator.ValidateAsync(context)).Status);
        store.Verify(x => x.GetSecretAsync(TestData.ServerSecretString), Times.Once());
    }

    [Fact]
    public async Task ConcurrentMisses_ShareSuccessfulLookup_AndOtherSecretsInSameEnvironmentMiss()
    {
        var lookup = new TaskCompletionSource<Secret?>(TaskCreationOptions.RunContinuationsAsynchronously);
        var entered = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var store = new Mock<IStore>();
        store.Setup(x => x.GetSecretAsync(TestData.ServerSecretString)).Returns(() =>
        {
            entered.TrySetResult();
            return lookup.Task;
        });
        using var host = app.WithWebHostBuilder(builder => builder.ConfigureTestServices(services =>
            services.Replace(ServiceDescriptor.Singleton(store.Object))));
        using var client = host.CreateClient();
        client.DefaultRequestHeaders.Add("Authorization", TestData.ServerSecretString);

        var requests = Enumerable.Range(0, 20).Select(_ => TrackAsync(client)).ToArray();
        await entered.Task.WaitAsync(TimeSpan.FromSeconds(10));
        lookup.SetResult(TestData.ServerSecret);
        var responses = await Task.WhenAll(requests);
        foreach (var response in responses)
        {
            using (response) Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        }
        store.Verify(x => x.GetSecretAsync(TestData.ServerSecretString), Times.Once());

        var otherSecret = GuidHelper.Encode(Guid.NewGuid()) + TestData.ServerSecretString[22..];
        client.DefaultRequestHeaders.Remove("Authorization");
        client.DefaultRequestHeaders.Add("Authorization", otherSecret);
        using var rejected = await TrackAsync(client);
        Assert.Equal(HttpStatusCode.Unauthorized, rejected.StatusCode);
        store.Verify(x => x.GetSecretAsync(otherSecret), Times.Once());
    }

    private static Task<HttpResponseMessage> TrackAsync(HttpClient client) =>
        client.PostAsJsonAsync("/api/public/insight/track", Array.Empty<object>());
}
