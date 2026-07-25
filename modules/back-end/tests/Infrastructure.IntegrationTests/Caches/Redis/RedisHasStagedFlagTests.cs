using Domain.FeatureFlags;
using Infrastructure.Caches.Redis;
using StackExchange.Redis;
using Infrastructure.IntegrationTests.Fixtures;

namespace Infrastructure.IntegrationTests.Caches.Redis;

/// <summary>
/// C3b-1 Part 2: RedisCacheService.HasStagedFlagAsync probes whether THIS Redis holds the
/// staged version key flag:{id}:v{ts} (written by StageFlagAsync).
///
/// Uses the shared Redis Testcontainers fixture and flushes the database per test class.
/// </summary>
[Collection(RedisCollection.Name)]
public class RedisHasStagedFlagTests : IntegrationTestBase, IAsyncLifetime
{
    private readonly RedisFixture _fixture;

    public RedisHasStagedFlagTests(RedisFixture fixture)
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
    public async Task HasStagedFlag_True_After_Stage_False_Otherwise()
    {
        var sut = _sut!;
        var db = _mux!.GetDatabase();

        var envId = Guid.NewGuid();
        var flagId = Guid.NewGuid();
        var ts = 9_000L;

        // not staged yet
        Assert.False(await sut.HasStagedFlagAsync(flagId, ts));

        // stage the version
        await sut.StageFlagAsync(NewFlag(envId, flagId, ts), ts);

        // present for this exact (id, ts)
        Assert.True(await sut.HasStagedFlagAsync(flagId, ts));

        // a different ts for the same flag is NOT staged
        Assert.False(await sut.HasStagedFlagAsync(flagId, ts + 1));

        // a different flag id is NOT staged
        Assert.False(await sut.HasStagedFlagAsync(Guid.NewGuid(), ts));

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
