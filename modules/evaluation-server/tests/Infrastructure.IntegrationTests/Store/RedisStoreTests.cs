using System.Text;
using Domain.Shared;
using Infrastructure.Caches.Redis;
using Infrastructure.IntegrationTests.Fixtures;
using Infrastructure.Store;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using StackExchange.Redis;

namespace Infrastructure.IntegrationTests.Store;

[Collection(RedisCollection.Name)]
public class RedisStoreTests : IntegrationTestBase, IAsyncLifetime
{
    private readonly RedisFixture _fixture;
    private ConnectionMultiplexer _connection = null!;
    private RedisStore _sut = null!;

    public RedisStoreTests(RedisFixture fixture)
    {
        _fixture = fixture;
    }

    public async Task InitializeAsync()
    {
        if (!DockerAvailability.IsAvailable)
        {
            return;
        }

        var options = ConfigurationOptions.Parse(_fixture.ConnectionString);
        options.AllowAdmin = true;
        _connection = await ConnectionMultiplexer.ConnectAsync(options);

        var server = _connection.GetServer(_connection.GetEndPoints().Single());
        await server.FlushDatabaseAsync();

        var clientMock = new Mock<IRedisClient>();
        clientMock.Setup(x => x.GetDatabase()).Returns(() => _connection.GetDatabase());
        clientMock.Setup(x => x.IsHealthyAsync()).ReturnsAsync(true);

        _sut = new RedisStore(clientMock.Object, NullLogger<RedisStore>.Instance);
    }

    public Task DisposeAsync()
    {
        _connection?.Dispose();
        return Task.CompletedTask;
    }

    [DockerFact]
    public async Task IsAvailableAsync_HealthyContainer_ReturnsTrue()
    {
        var available = await _sut.IsAvailableAsync();

        Assert.True(available);
    }

    [DockerFact]
    public async Task GetFlagsAsync_ByEnvAndTimestamp_ReturnsOnlyFlagsNewerThanTimestamp()
    {
        var envId = Guid.NewGuid();
        await SeedFlagAsync(envId, "flag-old", 1000, """{"id":"flag-old"}""");
        await SeedFlagAsync(envId, "flag-mid", 2000, """{"id":"flag-mid"}""");
        await SeedFlagAsync(envId, "flag-new", 3000, """{"id":"flag-new"}""");

        var result = (await _sut.GetFlagsAsync(envId, 1500)).Select(Encoding.UTF8.GetString).ToList();

        Assert.Equal(2, result.Count);
        Assert.Contains("""{"id":"flag-mid"}""", result);
        Assert.Contains("""{"id":"flag-new"}""", result);
    }

    [DockerFact]
    public async Task GetFlagsAsync_ByEnvAndTimestamp_TimestampEqualsScore_IsExcluded()
    {
        var envId = Guid.NewGuid();
        await SeedFlagAsync(envId, "boundary", 5000, """{"id":"boundary"}""");

        var result = (await _sut.GetFlagsAsync(envId, 5000)).ToList();

        Assert.Empty(result);
    }

    [DockerFact]
    public async Task GetFlagsAsync_ByIds_ReturnsRequestedFlagsOnly()
    {
        var envId = Guid.NewGuid();
        await SeedFlagAsync(envId, "a", 1, """{"id":"a"}""");
        await SeedFlagAsync(envId, "b", 2, """{"id":"b"}""");
        await SeedFlagAsync(envId, "c", 3, """{"id":"c"}""");

        var result = (await _sut.GetFlagsAsync(["a", "c"])).Select(Encoding.UTF8.GetString).ToList();

        Assert.Equal(2, result.Count);
        Assert.Contains("""{"id":"a"}""", result);
        Assert.Contains("""{"id":"c"}""", result);
    }

    [DockerFact]
    public async Task GetSegmentAsync_KnownId_ReturnsBytes()
    {
        const string id = "seg-1";
        var payload = """{"id":"seg-1","name":"finance"}""";
        await _connection.GetDatabase().StringSetAsync(RedisKeys.Segment(id), payload);

        var result = await _sut.GetSegmentAsync(id);

        Assert.Equal(payload, Encoding.UTF8.GetString(result));
    }

    [DockerFact]
    public async Task GetSegmentsAsync_SharedSegmentWithEmptyEnvId_HasEnvIdRewritten()
    {
        var envId = new Guid("00000000-0000-0000-0000-00000000abcd");
        var db = _connection.GetDatabase();

        var sharedPayload = """{"id":"shared","envId":"","name":"shared"}""";
        await db.StringSetAsync(RedisKeys.Segment("shared"), sharedPayload);
        await db.SortedSetAddAsync(RedisKeys.SegmentIndex(envId), "shared", 100);

        var ownPayload = $$"""{"id":"own","envId":"{{envId}}","name":"own"}""";
        await db.StringSetAsync(RedisKeys.Segment("own"), ownPayload);
        await db.SortedSetAddAsync(RedisKeys.SegmentIndex(envId), "own", 200);

        var result = (await _sut.GetSegmentsAsync(envId, 0)).Select(Encoding.UTF8.GetString).ToList();

        Assert.Equal(2, result.Count);
        Assert.Contains($$"""{"id":"shared","envId":"{{envId}}","name":"shared"}""", result);
        Assert.Contains(ownPayload, result);
    }

    [DockerFact]
    public async Task GetSecretAsync_UnknownSecret_ReturnsNull()
    {
        var result = await _sut.GetSecretAsync("does-not-exist");

        Assert.Null(result);
    }

    [DockerFact]
    public async Task GetSecretAsync_KnownSecret_ReturnsParsedSecret()
    {
        const string secretString = "test-secret-value";
        var envId = Guid.NewGuid();
        var db = _connection.GetDatabase();
        var key = RedisKeys.Secret(secretString);

        await db.HashSetAsync(key,
        [
            new HashEntry("type", SecretTypes.Server),
            new HashEntry("projectKey", "webapp"),
            new HashEntry("envId", envId.ToString()),
            new HashEntry("envKey", "dev")
        ]);

        var result = await _sut.GetSecretAsync(secretString);

        Assert.NotNull(result);
        Assert.Equal(SecretTypes.Server, result!.Type);
        Assert.Equal("webapp", result.ProjectKey);
        Assert.Equal(envId, result.EnvId);
        Assert.Equal("dev", result.EnvKey);
    }

    private async Task SeedFlagAsync(Guid envId, string flagId, double timestampScore, string payload)
    {
        var db = _connection.GetDatabase();
        await db.StringSetAsync(RedisKeys.Flag(flagId), payload);
        await db.SortedSetAddAsync(RedisKeys.FlagIndex(envId), flagId, timestampScore);
    }
}
