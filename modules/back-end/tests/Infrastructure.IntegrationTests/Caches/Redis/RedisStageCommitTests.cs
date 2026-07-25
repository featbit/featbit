using Domain.FeatureFlags;
using Infrastructure.Caches.Redis;
using StackExchange.Redis;
using Infrastructure.IntegrationTests.Fixtures;

namespace Infrastructure.IntegrationTests.Caches.Redis;

/// <summary>
/// Integration tests for the B1 Redis stage/commit storage feature.
///
/// These tests use the shared Redis Testcontainers fixture and flush the database per test class.
/// </summary>
[Collection(RedisCollection.Name)]
public class RedisStageCommitTests : IntegrationTestBase, IAsyncLifetime
{
    private readonly RedisFixture _fixture;

    public RedisStageCommitTests(RedisFixture fixture)
    {
        _fixture = fixture;
    }

    private ConnectionMultiplexer? _mux;
    private RedisCacheService? _sut;

    public async Task InitializeAsync()
    {
        if (!DockerAvailability.IsAvailable)
        {
            return;
        }

        var options = ConfigurationOptions.Parse(_fixture.ConnectionString);
        options.AllowAdmin = true;

        _mux = await ConnectionMultiplexer.ConnectAsync(options);

        var server = _mux.GetServer(_mux.GetEndPoints().Single());
        await server.FlushDatabaseAsync();

        _sut = new RedisCacheService(new TestRedisClient(_mux));
    }

    public Task DisposeAsync()
    {
        _mux?.Dispose();
        return Task.CompletedTask;
    }

    [DockerFact]
    public async Task StageThenCommit_KeepsOldCommittedValueReadableUntilCommit()
    {
        var sut = _sut!;
        var db = _mux!.GetDatabase();

        var envId = Guid.NewGuid();
        var flagId = Guid.NewGuid();
        var flagIdString = flagId.ToString();

        // baseline: commit v1 first so there is an existing committed pointer
        var v1 = 1_000L;
        var flagV1 = NewFlag(envId, flagId, v1);
        await sut.StageFlagAsync(flagV1, v1);
        await sut.CommitFlagAsync(envId, flagIdString, v1);

        var committedKey = RedisKeys.FlagCommittedPointer(flagId);
        var indexKey = RedisKeys.FlagIndex(envId);

        Assert.Equal(v1.ToString(), (string?)await db.StringGetAsync(committedKey));
        Assert.Equal(v1, await db.SortedSetScoreAsync(indexKey, flagIdString));

        // stage v2: the versioned value key must be written, but the committed
        // pointer and the index score must remain pointing at v1.
        var v2 = 2_000L;
        var flagV2 = NewFlag(envId, flagId, v2);
        await sut.StageFlagAsync(flagV2, v2);

        Assert.True(await db.KeyExistsAsync(RedisKeys.FlagVersion(flagId, v2)),
            "staged versioned value key should exist");
        Assert.True(await db.KeyExistsAsync(RedisKeys.FlagVersion(flagId, v1)),
            "previously committed versioned value key should still exist");

        // ACCEPTANCE: after StageFlagAsync the committed pointer is unchanged.
        Assert.Equal(v1.ToString(), (string?)await db.StringGetAsync(committedKey));
        Assert.Equal(v1, await db.SortedSetScoreAsync(indexKey, flagIdString));

        // commit v2: pointer flips to v2 and index score advances to v2.
        await sut.CommitFlagAsync(envId, flagIdString, v2);

        // ACCEPTANCE: after CommitFlagAsync, pointer == ts.
        Assert.Equal(v2.ToString(), (string?)await db.StringGetAsync(committedKey));
        Assert.Equal(v2, await db.SortedSetScoreAsync(indexKey, flagIdString));

        // cleanup
        await db.KeyDeleteAsync(committedKey);
        await db.KeyDeleteAsync(RedisKeys.FlagVersion(flagId, v1));
        await db.KeyDeleteAsync(RedisKeys.FlagVersion(flagId, v2));
        await db.SortedSetRemoveAsync(indexKey, flagIdString);
    }

    [DockerFact]
    public async Task StageFlagAsync_DoesNotTouchSortedSetIndex()
    {
        var sut = _sut!;
        var db = _mux!.GetDatabase();

        var envId = Guid.NewGuid();
        var flagId = Guid.NewGuid();
        var flagIdString = flagId.ToString();
        var indexKey = RedisKeys.FlagIndex(envId);

        var ts = 5_000L;
        var flag = NewFlag(envId, flagId, ts);

        // No prior commit, so the index has no member for this flag.
        await sut.StageFlagAsync(flag, ts);

        // staging must NOT add the flag to the env index nor move the committed pointer.
        Assert.False((await db.SortedSetScoreAsync(indexKey, flagIdString)).HasValue,
            "staging must not write the sorted-set index");
        Assert.False(await db.KeyExistsAsync(RedisKeys.FlagCommittedPointer(flagId)),
            "staging must not write the committed pointer");

        // cleanup
        await db.KeyDeleteAsync(RedisKeys.FlagVersion(flagId, ts));
    }

    private static FeatureFlag NewFlag(Guid envId, Guid flagId, long ts) => new()
    {
        Id = flagId,
        EnvId = envId,
        UpdatedAt = DateTimeOffset.FromUnixTimeMilliseconds(ts).UtcDateTime
    };

    private sealed class TestRedisClient(IConnectionMultiplexer connection) : IRedisClient
    {
        public IConnectionMultiplexer Connection { get; } = connection;

        public IDatabase GetDatabase() => Connection.GetDatabase();
    }
}
