using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Api.Services;
using Domain.EndUsers;
using Domain.Insights;
using Domain.Messages;
using Domain.Secrets;
using Domain.Shared;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Moq;
using Streaming.Services;
using Streaming.Protocol;

namespace Application.IntegrationTests.Http;

[Collection(nameof(TestApp))]
public class SecretAuthorizationTests(TestApp app)
{
    private static readonly string[] Endpoints =
        ["sdk/server/latest-all", "sdk/client/latest-all", "featureflag/evaluate", "insight/track"];

    public static IEnumerable<object[]> KeyTypeCases()
    {
        foreach (var endpoint in Endpoints)
        {
            yield return [endpoint, TestData.ClientSecretString, TestData.ClientSecret,
                endpoint == "sdk/server/latest-all" ? HttpStatusCode.Forbidden : HttpStatusCode.OK];
            yield return [endpoint, TestData.ServerSecretString, TestData.ServerSecret,
                endpoint == "sdk/client/latest-all" ? HttpStatusCode.Forbidden : HttpStatusCode.OK];
            yield return [endpoint, TestData.ServerSecretString,
                new Secret("unknown", "p", TestData.ServerEnvId, "e"), HttpStatusCode.Forbidden];
        }
    }

    [Theory]
    [MemberData(nameof(KeyTypeCases))]
    public async Task Endpoint_EnforcesSecretType(
        string endpoint, string token, Secret secret, HttpStatusCode expected)
    {
        var store = new Mock<IStore>();
        store.Setup(x => x.GetSecretAsync(token)).ReturnsAsync(secret);
        var sync = new Mock<IDataSyncService>();
        sync.Setup(x => x.GetServerSdkPayloadAsync(secret.EnvId, 0))
            .ReturnsAsync(new ServerSdkPayload(DataSyncEventTypes.Patch, [], []));
        sync.Setup(x => x.GetClientSdkPayloadAsync(secret.EnvId, It.IsAny<EndUser>(), 0))
            .ReturnsAsync(new ClientSdkPayload(DataSyncEventTypes.Patch, "auth-test-user", []));
        var flags = new Mock<IFeatureFlagService>();
        flags.Setup(x => x.GetListAsync(secret.EnvId, It.IsAny<FeatureFlagFilter>()))
            .ReturnsAsync(Array.Empty<JsonElement>());
        var producer = new Mock<IMessageProducer>();
        using var host = app.WithWebHostBuilder(builder => builder.ConfigureTestServices(services =>
        {
            services.Replace(ServiceDescriptor.Singleton(store.Object));
            services.Replace(ServiceDescriptor.Singleton(sync.Object));
            services.Replace(ServiceDescriptor.Singleton(flags.Object));
            services.Replace(ServiceDescriptor.Singleton(producer.Object));
        }));
        using var client = host.CreateClient();
        client.DefaultRequestHeaders.Add("Authorization", token);

        using var response = await SendAsync(client, endpoint);

        Assert.Equal(expected, response.StatusCode);
        if (expected == HttpStatusCode.Forbidden)
        {
            sync.VerifyNoOtherCalls();
            flags.VerifyNoOtherCalls();
            producer.VerifyNoOtherCalls();
        }
    }

    public static IEnumerable<object[]> InvalidCredentialCases()
    {
        foreach (var endpoint in Endpoints)
        foreach (var credential in new[] { "missing", "malformed", "not-found", "unavailable", "wrong-env" })
            yield return [endpoint, credential];
    }

    [Theory]
    [MemberData(nameof(InvalidCredentialCases))]
    public async Task Endpoint_RejectsInvalidOrUnavailableCredentials(string endpoint, string credential)
    {
        var token = credential == "malformed" ? "invalid" : TestData.ServerSecretString;
        var store = new Mock<IStore>(MockBehavior.Strict);
        if (credential == "unavailable")
            store.Setup(x => x.GetSecretAsync(token)).ThrowsAsync(new InvalidOperationException("offline"));
        else if (credential == "wrong-env")
            store.Setup(x => x.GetSecretAsync(token))
                .ReturnsAsync(new Secret(SecretTypes.Server, "p", Guid.NewGuid(), "e"));
        else if (credential == "not-found")
            store.Setup(x => x.GetSecretAsync(token)).ReturnsAsync((Secret?)null);

        var sync = new Mock<IDataSyncService>();
        var flags = new Mock<IFeatureFlagService>();
        var producer = new Mock<IMessageProducer>();
        using var host = app.WithWebHostBuilder(builder => builder.ConfigureTestServices(services =>
        {
            services.Replace(ServiceDescriptor.Singleton(store.Object));
            services.Replace(ServiceDescriptor.Singleton(sync.Object));
            services.Replace(ServiceDescriptor.Singleton(flags.Object));
            services.Replace(ServiceDescriptor.Singleton(producer.Object));
        }));
        using var client = host.CreateClient();
        if (credential != "missing") client.DefaultRequestHeaders.Add("Authorization", token);

        using var response = await SendAsync(client, endpoint);

        Assert.Equal(credential == "unavailable" ? HttpStatusCode.ServiceUnavailable : HttpStatusCode.Unauthorized,
            response.StatusCode);
        store.Verify(x => x.GetSecretAsync(token), credential is "missing" or "malformed" ? Times.Never() : Times.Once());
        store.VerifyNoOtherCalls();
        sync.VerifyNoOtherCalls();
        flags.VerifyNoOtherCalls();
        producer.VerifyNoOtherCalls();
    }

    [Theory]
    [InlineData("sdk/server/latest-all")]
    [InlineData("sdk/client/latest-all")]
    [InlineData("featureflag/evaluate")]
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
            services.Replace(ServiceDescriptor.Singleton(store.Object))));
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
            "insight/track" => client.PostAsJsonAsync(path, new[] { new Insight { User = user,
                Metrics = [new MetricInsight { Type = "Custom", EventName = "purchase", NumericValue = 1 }] } }),
            _ => throw new ArgumentOutOfRangeException(nameof(endpoint), endpoint, "Unknown test endpoint")
        };
    }
}
