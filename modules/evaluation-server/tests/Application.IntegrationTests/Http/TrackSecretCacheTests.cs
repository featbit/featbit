using System.Net;
using System.Net.Http.Json;
using Domain.Secrets;
using Domain.Shared;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Moq;

namespace Application.IntegrationTests.Http;

[Collection(nameof(TestApp))]
public class TrackSecretCacheTests(TestApp app)
{
    [Theory]
    [InlineData("missing", HttpStatusCode.Unauthorized)]
    [InlineData("wrong-env", HttpStatusCode.Unauthorized)]
    [InlineData("wrong-type", HttpStatusCode.Forbidden)]
    public async Task RejectedSecret_IsNotCached(string reason, HttpStatusCode expected)
    {
        Secret? invalid = reason switch
        {
            "missing" => null,
            "wrong-env" => new Secret(SecretTypes.Server, "p", Guid.NewGuid(), "e"),
            _ => new Secret("unknown", "p", TestData.ServerEnvId, "e")
        };
        var store = new Mock<IStore>();
        store.SetupSequence(x => x.GetSecretAsync(TestData.ServerSecretString))
            .ReturnsAsync(invalid).ReturnsAsync(TestData.ServerSecret);
        using var host = app.WithWebHostBuilder(builder => builder.ConfigureTestServices(services =>
            services.Replace(ServiceDescriptor.Singleton(store.Object))));
        using var client = host.CreateClient();
        client.DefaultRequestHeaders.Add("Authorization", TestData.ServerSecretString);

        using var first = await TrackAsync(client);
        using var second = await TrackAsync(client);
        Assert.Equal(expected, first.StatusCode);
        Assert.Equal(HttpStatusCode.OK, second.StatusCode);
        store.Verify(x => x.GetSecretAsync(TestData.ServerSecretString), Times.Exactly(2));
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task CachedSecret_ExpiresDespiteHits_ThenRejectsRevocationOrOutage(bool unavailable)
    {
        var store = new Mock<IStore>();
        store.Setup(x => x.GetSecretAsync(TestData.ServerSecretString)).ReturnsAsync(TestData.ServerSecret);
        using var host = app.WithWebHostBuilder(builder => builder.ConfigureTestServices(services =>
            services.Replace(ServiceDescriptor.Singleton(store.Object))));
        using var client = host.CreateClient();
        client.DefaultRequestHeaders.Add("Authorization", TestData.ServerSecretString);

        using var first = await TrackAsync(client);
        Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        if (unavailable)
            store.Setup(x => x.GetSecretAsync(TestData.ServerSecretString)).ThrowsAsync(new IOException("offline"));
        else
            store.Setup(x => x.GetSecretAsync(TestData.ServerSecretString)).ReturnsAsync((Secret?)null);

        // Hit the cache throughout its original lifetime; this must not slide expiration.
        for (var i = 0; i < 4; i++)
        {
            await Task.Delay(1000);
            using var hit = await TrackAsync(client);
            Assert.Equal(HttpStatusCode.OK, hit.StatusCode);
        }
        store.Verify(x => x.GetSecretAsync(TestData.ServerSecretString), Times.Once());

        await Task.Delay(1100);
        var expected = unavailable ? HttpStatusCode.ServiceUnavailable : HttpStatusCode.Unauthorized;
        using var expired = await TrackAsync(client);
        using var retry = await TrackAsync(client);
        Assert.Equal(expected, expired.StatusCode);
        Assert.Equal(expected, retry.StatusCode);
        store.Verify(x => x.GetSecretAsync(TestData.ServerSecretString), Times.Exactly(3));
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
