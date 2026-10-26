using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Api.Services;
using Domain.EndUsers;
using Domain.Insights;
using Domain.Messages;
using Domain.Shared;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Moq;
using Streaming.Services;

namespace Application.IntegrationTests.Http;

[Collection(nameof(TestApp))]
public class SecretAuthorizationTests(TestApp app)
{
    public static IEnumerable<object[]> Cases()
    {
        foreach (var endpoint in new[] { "sdk/server/latest-all", "sdk/client/latest-all", "featureflag/evaluate", "insight/track" })
        foreach (var credential in new[] { "client", "server", "missing", "malformed", "forged", "deleted", "unavailable", "wrong-env", "unknown-type" })
            yield return new object[] { endpoint, credential };
    }

    [Theory]
    [MemberData(nameof(Cases))]
    public async Task Endpoint_EnforcesCompleteSecretAndType(string endpoint, string credential)
    {
        var store = new Mock<IStore>(MockBehavior.Strict);
        var producer = new Mock<IMessageProducer>();
        var sync = new Mock<IDataSyncService>();
        var flags = new Mock<IFeatureFlagService>(MockBehavior.Strict);
        var token = credential == "client" ? TestData.ClientSecretString : TestData.ServerSecretString;
        var secret = credential == "client" ? TestData.ClientSecret : TestData.ServerSecret;
        if (credential == "malformed") token = "invalid";
        if (credential == "forged") token = new string('x', 22) + token[22..];
        if (credential == "wrong-env") secret = new Secret(SecretTypes.Server, "p", Guid.NewGuid(), "e");
        if (credential == "unknown-type") secret = new Secret("unknown", "p", TestData.ServerEnvId, "e");
        if (credential == "unavailable")
            store.Setup(x => x.GetSecretAsync(token)).ThrowsAsync(new InvalidOperationException("offline"));
        else
            store.Setup(x => x.GetSecretAsync(token)).ReturnsAsync(
                credential is "forged" or "deleted" ? null : secret);

        var expected = credential switch
        {
            "client" when endpoint == "sdk/server/latest-all" => HttpStatusCode.Forbidden,
            "server" when endpoint == "sdk/client/latest-all" => HttpStatusCode.Forbidden,
            "client" or "server" => HttpStatusCode.OK,
            "unavailable" => HttpStatusCode.ServiceUnavailable,
            _ => HttpStatusCode.Unauthorized
        };
        if (expected == HttpStatusCode.OK && endpoint == "featureflag/evaluate")
        {
            flags.Setup(x => x.GetListAsync(secret.EnvId, It.IsAny<FeatureFlagFilter>()))
                .ReturnsAsync(Array.Empty<JsonElement>());
        }
        using var host = app.WithWebHostBuilder(builder => builder.ConfigureTestServices(services =>
        {
            services.Replace(ServiceDescriptor.Singleton<IStore>(store.Object));
            services.Replace(ServiceDescriptor.Singleton<IMessageProducer>(producer.Object));
            services.Replace(ServiceDescriptor.Singleton<IFeatureFlagService>(flags.Object));
            if (expected != HttpStatusCode.OK)
            {
                services.Replace(ServiceDescriptor.Singleton<IDataSyncService>(sync.Object));
            }
        }));
        // Successful SDK requests use empty data, while still checking the authenticated environment.
        store.Setup(x => x.GetFlagsAsync(secret.EnvId, 0)).ReturnsAsync(Array.Empty<byte[]>());
        store.Setup(x => x.GetSegmentsAsync(secret.EnvId, 0)).ReturnsAsync(Array.Empty<byte[]>());
        using var client = host.CreateClient();
        if (credential != "missing") client.DefaultRequestHeaders.Add("Authorization", token);
        using var response = await SendAsync(client, endpoint);
        Assert.Equal(expected, response.StatusCode);
        store.Verify(x => x.GetSecretAsync(token), credential is "missing" or "malformed" ? Times.Never() : Times.Once());
        if (expected != HttpStatusCode.OK)
        {
            sync.VerifyNoOtherCalls();
            flags.VerifyNoOtherCalls();
            producer.VerifyNoOtherCalls();
            store.Verify(x => x.GetFlagsAsync(It.IsAny<Guid>(), It.IsAny<long>()), Times.Never);
            store.Verify(x => x.GetSegmentsAsync(It.IsAny<Guid>(), It.IsAny<long>()), Times.Never);
        }
        else if (endpoint == "featureflag/evaluate")
        {
            flags.Verify(x => x.GetListAsync(secret.EnvId, It.IsAny<FeatureFlagFilter>()), Times.Once);
            flags.VerifyNoOtherCalls();
        }
        else if (endpoint == "insight/track")
        {
            producer.Verify(x => x.PublishBatchAsync(Topics.EndUser,
                It.Is<IReadOnlyCollection<EndUserMessage>>(messages => messages.Count == 1 &&
                    messages.All(message => message.EnvId == secret.EnvId))), Times.Once);
            producer.Verify(x => x.PublishBatchAsync(Topics.Insights,
                It.Is<IReadOnlyCollection<InsightMessage>>(messages => messages.Count == 1 &&
                    messages.All(message => message.EnvId == secret.EnvId.ToString()))), Times.Once);
            Assert.Equal(3, producer.Invocations.Count);
        }
    }

    [Theory]
    [InlineData("sdk/server/latest-all")]
    [InlineData("sdk/client/latest-all")]
    [InlineData("featureflag/evaluate")]
    [InlineData("insight/track")]
    public async Task RevokedSecret_IsRejectedOnNextRequest(string endpoint)
    {
        var isClient = endpoint == "sdk/client/latest-all";
        var token = isClient ? TestData.ClientSecretString : TestData.ServerSecretString;
        var secret = isClient ? TestData.ClientSecret : TestData.ServerSecret;
        var store = new Mock<IStore>();
        store.SetupSequence(x => x.GetSecretAsync(token)).ReturnsAsync(secret).ReturnsAsync((Secret?)null);
        store.Setup(x => x.GetFlagsAsync(secret.EnvId, 0)).ReturnsAsync(Array.Empty<byte[]>());
        store.Setup(x => x.GetSegmentsAsync(secret.EnvId, 0)).ReturnsAsync(Array.Empty<byte[]>());
        using var host = app.WithWebHostBuilder(builder => builder.ConfigureTestServices(services =>
            services.Replace(ServiceDescriptor.Singleton<IStore>(store.Object))));
        using var client = host.CreateClient();
        client.DefaultRequestHeaders.Add("Authorization", token);
        using var first = await SendAsync(client, endpoint);
        using var second = await SendAsync(client, endpoint);
        Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, second.StatusCode);
        store.Verify(x => x.GetSecretAsync(token), Times.Exactly(2));
    }

    private static Task<HttpResponseMessage> SendAsync(HttpClient client, string endpoint)
    {
        var path = "/api/public/" + endpoint;
        var user = new EndUser { KeyId = "auth-test-user" };
        return endpoint switch
        {
            "sdk/server/latest-all" => client.GetAsync(path),
            "sdk/client/latest-all" => client.PostAsJsonAsync(path, user),
            "featureflag/evaluate" => client.PostAsJsonAsync(path, new { user }),
            _ => client.PostAsJsonAsync(path, new[] { new Insight { User = user,
                Metrics = [new MetricInsight { Type = "Custom", EventName = "purchase", NumericValue = 1 }] } })
        };
    }
}
