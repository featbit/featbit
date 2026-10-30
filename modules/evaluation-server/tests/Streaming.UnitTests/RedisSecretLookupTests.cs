using Domain.Shared;
using Infrastructure.Caches.Redis;
using Infrastructure.Store;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using StackExchange.Redis;
using Streaming.ControlPlane;

namespace Streaming.UnitTests;

public class RedisSecretLookupTests
{
    [Theory]
    [InlineData(false, "valid")]
    [InlineData(true, "valid")]
    [InlineData(false, "missing")]
    [InlineData(true, "missing")]
    [InlineData(false, "partial")]
    [InlineData(true, "partial")]
    [InlineData(false, "invalid-env")]
    [InlineData(true, "invalid-env")]
    public async Task Lookup_UsesOneHashReadAndRejectsIncompleteRecords(bool gated, string record)
    {
        const string token = "complete-secret-value";
        var envId = Guid.NewGuid();
        RedisValue[] fields = ["server", "project", envId.ToString(), "env"];
        if (record == "missing") fields = new RedisValue[4];
        if (record == "partial") fields[0] = RedisValue.Null;
        if (record == "invalid-env") fields[2] = "invalid";
        var db = new Mock<IDatabase>(MockBehavior.Strict);
        db.Setup(x => x.HashGetAsync(RedisKeys.Secret(token),
                It.Is<RedisValue[]>(v => v.Length == 4 && v[0] == "type" && v[1] == "projectKey" && v[2] == "envId" && v[3] == "envKey"),
                CommandFlags.None)).ReturnsAsync(fields);
        var client = new Mock<IRedisClient>();
        client.Setup(x => x.GetDatabase()).Returns(db.Object);
        IStore store = gated
            ? new GatedCommitRedisStore(client.Object, NullLogger<GatedCommitRedisStore>.Instance)
            : new RedisStore(client.Object, NullLogger<RedisStore>.Instance);

        var secret = await store.GetSecretAsync(token);

        if (record == "valid")
        {
            Assert.NotNull(secret);
            Assert.Equal(envId, secret.EnvId);
            Assert.Equal("server", secret.Type);
            Assert.Equal("project", secret.ProjectKey);
            Assert.Equal("env", secret.EnvKey);
        }
        else Assert.Null(secret);
        Assert.Single(db.Invocations);
    }
}
