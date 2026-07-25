using Application.ControlPlane;
using Infrastructure.AppService;
using Infrastructure.Caches.Redis;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using StackExchange.Redis;
using Infrastructure.IntegrationTests.Fixtures;

namespace Infrastructure.IntegrationTests.AppService;

/// <summary>
/// Integration tests for the B5 staged-flag version GC worker (<see cref="StagedFlagGcWorker"/>).
///
/// These tests use the shared Redis Testcontainers fixture and flush the database per test class.
/// </summary>
[Collection(RedisCollection.Name)]
public class StagedFlagGcWorkerTests : IntegrationTestBase, IAsyncLifetime
{
    private readonly RedisFixture _fixture;

    public StagedFlagGcWorkerTests(RedisFixture fixture)
    {
        _fixture = fixture;
    }

    private ConnectionMultiplexer? _mux;

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
    }

    public Task DisposeAsync()
    {
        _mux?.Dispose();
        return Task.CompletedTask;
    }

    [DockerFact]
    public async Task RunGcOnce_DeletesSupersededVersions_KeepsCommittedAndPointer()
    {
        var db = _mux!.GetDatabase();
        var sut = CreateSut();

        var flagId = Guid.NewGuid();
        const long v1 = 1000L;
        const long v2 = 2000L;

        var v1Key = RedisKeys.FlagVersion(flagId, v1);
        var v2Key = RedisKeys.FlagVersion(flagId, v2);
        var pointerKey = RedisKeys.FlagCommittedPointer(flagId);

        // seed: two versioned value keys + a committed pointer at v2.
        await db.StringSetAsync(v1Key, "v1-value");
        await db.StringSetAsync(v2Key, "v2-value");
        await db.StringSetAsync(pointerKey, v2);

        try
        {
            var deleted = await sut.RunGcOnceAsync();

            Assert.True(deleted >= 1, "at least the superseded :v1 key should be deleted");

            // ACCEPTANCE: superseded version is gone.
            Assert.False(await db.KeyExistsAsync(v1Key), "superseded :v1000 key must be deleted");

            // ACCEPTANCE: committed version + pointer are intact.
            Assert.True(await db.KeyExistsAsync(v2Key), "committed :v2000 key must be kept");
            Assert.Equal(v2.ToString(), (string?)await db.StringGetAsync(pointerKey));
        }
        finally
        {
            await db.KeyDeleteAsync(v1Key);
            await db.KeyDeleteAsync(v2Key);
            await db.KeyDeleteAsync(pointerKey);
        }
    }

    [DockerFact]
    public async Task RunGcOnce_LeavesFlagWithoutCommittedPointerUntouched()
    {
        var db = _mux!.GetDatabase();
        var sut = CreateSut();

        var flagId = Guid.NewGuid();
        const long v1 = 1000L;
        const long v2 = 2000L;

        var v1Key = RedisKeys.FlagVersion(flagId, v1);
        var v2Key = RedisKeys.FlagVersion(flagId, v2);
        var pointerKey = RedisKeys.FlagCommittedPointer(flagId);

        // seed: versioned value keys but NO committed pointer.
        await db.StringSetAsync(v1Key, "v1-value");
        await db.StringSetAsync(v2Key, "v2-value");

        try
        {
            await sut.RunGcOnceAsync();

            // ACCEPTANCE: no committed pointer => nothing is deleted.
            Assert.True(await db.KeyExistsAsync(v1Key), ":v1000 must be kept (no committed pointer)");
            Assert.True(await db.KeyExistsAsync(v2Key), ":v2000 must be kept (no committed pointer)");
            Assert.False(await db.KeyExistsAsync(pointerKey));
        }
        finally
        {
            await db.KeyDeleteAsync(v1Key);
            await db.KeyDeleteAsync(v2Key);
        }
    }

    private StagedFlagGcWorker CreateSut()
    {
        // GatedCommit so the worker is enabled; RunGcOnceAsync runs the sweep regardless of timer.
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ControlPlane:ConsistencyMode"] = nameof(ConsistencyMode.GatedCommit)
            })
            .Build();

        return new StagedFlagGcWorker(
            new TestRedisClient(_mux!),
            configuration,
            NullLogger<StagedFlagGcWorker>.Instance);
    }

    private sealed class TestRedisClient(IConnectionMultiplexer connection) : IRedisClient
    {
        public IConnectionMultiplexer Connection { get; } = connection;

        public IDatabase GetDatabase() => Connection.GetDatabase();
    }
}
