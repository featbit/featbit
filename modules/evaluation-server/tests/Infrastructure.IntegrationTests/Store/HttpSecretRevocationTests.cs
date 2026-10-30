using System.Net;
using System.Net.Http.Json;
using Domain.EndUsers;
using Domain.Insights;
using Domain.Messages;
using Domain.Shared;
using Infrastructure.Caches;
using Infrastructure.Caches.Redis;
using Infrastructure.IntegrationTests.Fixtures;
using Infrastructure.MQ;
using Infrastructure.Persistence;
using Infrastructure.Store;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using StackExchange.Redis;
using Streaming.ControlPlane;

namespace Infrastructure.IntegrationTests.Store;

[Collection(RedisCollection.Name)]
public class HttpSecretRevocationTests(RedisFixture fixture) : IntegrationTestBase
{
    public static IEnumerable<object[]> Endpoints()
    {
        foreach (var gated in new[] { false, true })
        {
            yield return [gated, "sdk/server/latest-all", SecretTypes.Server];
            yield return [gated, "sdk/client/latest-all", SecretTypes.Client];
            foreach (var type in new[] { SecretTypes.Client, SecretTypes.Server })
            {
                yield return [gated, "featureflag/evaluate", type];
                yield return [gated, "insight/track", type];
            }
        }
    }

    [DockerTheory]
    [MemberData(nameof(Endpoints))]
    public async Task RedisDeletion_RevokesHttpAccessAcrossHosts_WithoutRevokingReplacement(
        bool gated, string endpoint, string type)
    {
        using var connection = await ConnectionMultiplexer.ConnectAsync(fixture.ConnectionString);
        var database = connection.GetDatabase();
        var envId = Guid.NewGuid();
        var oldToken = GuidHelper.Encode(Guid.NewGuid()) + GuidHelper.Encode(envId);
        var replacementToken = GuidHelper.Encode(Guid.NewGuid()) + GuidHelper.Encode(envId);
        var producer = new Mock<IMessageProducer>();

        // Only the connection adapter is mocked; both hosts authenticate through production
        // Redis store implementations, with real HMGET/DEL operations in an isolated container.
        using var firstHost = CreateHost(connection, gated, producer.Object);
        using var secondHost = CreateHost(connection, gated, producer.Object);
        using var firstClient = firstHost.CreateClient();
        using var secondClient = secondHost.CreateClient();
        try
        {
            // A structurally valid secret must not work until its exact Redis record exists.
            using (var absent = await SendAsync(firstClient, endpoint, oldToken))
                Assert.Equal(HttpStatusCode.Unauthorized, absent.StatusCode);
            producer.VerifyNoOtherCalls();

            await SeedAsync(oldToken);
            await SeedAsync(replacementToken);
            foreach (var client in new[] { firstClient, secondClient })
            {
                using var accepted = await SendAsync(client, endpoint, oldToken);
                Assert.Equal(HttpStatusCode.OK, accepted.StatusCode);
            }
            if (endpoint == "insight/track")
                Assert.Contains(producer.Invocations, invocation =>
                    invocation.Arguments[0] is string topic && topic == Topics.Insights);

            // This is the actual shared-store deletion, not a mocked sequence of return values.
            Assert.True(await database.KeyDeleteAsync(RedisKeys.Secret(oldToken)));
            Assert.False(await database.KeyExistsAsync(RedisKeys.Secret(oldToken)));
            var callsBeforeRevokedRequests = producer.Invocations.Count;
            foreach (var client in new[] { firstClient, secondClient })
            {
                using var revoked = await SendAsync(client, endpoint, oldToken);
                Assert.Equal(HttpStatusCode.Unauthorized, revoked.StatusCode);
            }
            Assert.Equal(callsBeforeRevokedRequests, producer.Invocations.Count);

            // Rotation removes one complete credential, not every credential for that environment.
            foreach (var client in new[] { firstClient, secondClient })
            {
                using var replacement = await SendAsync(client, endpoint, replacementToken);
                Assert.Equal(HttpStatusCode.OK, replacement.StatusCode);
            }
        }
        finally
        {
            await database.KeyDeleteAsync(RedisKeys.Secret(oldToken));
            await database.KeyDeleteAsync(RedisKeys.Secret(replacementToken));
        }

        Task SeedAsync(string token) => database.HashSetAsync(RedisKeys.Secret(token),
        [
            new HashEntry("type", type),
            new HashEntry("projectKey", "revocation-test"),
            new HashEntry("envId", envId.ToString()),
            new HashEntry("envKey", "test")
        ]);
    }

    private static WebApplicationFactory<Program> CreateHost(
        IConnectionMultiplexer connection, bool gated, IMessageProducer producer) =>
        new RevocationTestApp(connection, gated, producer);

    private sealed class RevocationTestApp(
        IConnectionMultiplexer connection, bool gated, IMessageProducer producer) : WebApplicationFactory<Program>
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            // Unrelated flag evaluation and messaging need no external dependencies.
            builder.UseSetting(DbProvider.SectionName, DbProvider.Fake);
            builder.UseSetting(CacheProvider.SectionName, CacheProvider.None);
            builder.UseSetting(MqProvider.SectionName, MqProvider.None);
            builder.UseSetting("RateLimiting:Enabled", "false");
            builder.ConfigureTestServices(services =>
            {
                var redis = new Mock<IRedisClient>();
                redis.Setup(x => x.GetDatabase()).Returns(connection.GetDatabase());
                redis.Setup(x => x.IsHealthyAsync()).ReturnsAsync(true);
                IStore store = gated
                    ? new GatedCommitRedisStore(redis.Object, NullLogger<GatedCommitRedisStore>.Instance)
                    : new RedisStore(redis.Object, NullLogger<RedisStore>.Instance);
                services.Replace(ServiceDescriptor.Singleton<IStore>(store));
                services.Replace(ServiceDescriptor.Singleton<IMessageProducer>(producer));
            });
        }
    }

    private static async Task<HttpResponseMessage> SendAsync(HttpClient client, string endpoint, string token)
    {
        using var request = new HttpRequestMessage(
            endpoint == "sdk/server/latest-all" ? HttpMethod.Get : HttpMethod.Post, "/api/public/" + endpoint);
        request.Headers.Add("Authorization", token);
        var user = new EndUser { KeyId = "revocation-test-user" };
        request.Content = endpoint switch
        {
            "sdk/server/latest-all" => null,
            "sdk/client/latest-all" => JsonContent.Create(user),
            "featureflag/evaluate" => JsonContent.Create(new { user }),
            _ => JsonContent.Create(new[] { new Insight { User = user,
                Metrics = [new MetricInsight { Type = "Custom", EventName = "purchase", NumericValue = 1 }] } })
        };
        return await client.SendAsync(request);
    }
}
