using System.Text;
using Infrastructure.Caches.Redis;
using Infrastructure.IntegrationTests.Fixtures;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using StackExchange.Redis;
using Streaming.ControlPlane;

namespace Infrastructure.IntegrationTests.ControlPlane;

/// <summary>
/// D2 integration tests: <see cref="GatedCommitRedisStore"/> flag reads must honor the committed pointer
/// written by the back-end gated commit path, and fall back to the legacy main key otherwise.
///
/// Uses the shared Redis Testcontainer and flushes Redis before each test.
/// </summary>
[Collection(RedisCollection.Name)]
public class GatedCommitReadFlagTests : IntegrationTestBase, IAsyncLifetime
{
    private readonly RedisFixture _fixture;
    private ConnectionMultiplexer _connection = null!;
    private IDatabase _db = null!;
    private GatedCommitRedisStore _sut = null!;

    public GatedCommitReadFlagTests(RedisFixture fixture)
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

        _db = _connection.GetDatabase();
        var clientMock = new Mock<IRedisClient>();
        clientMock.Setup(x => x.GetDatabase()).Returns(_db);
        clientMock.Setup(x => x.IsHealthyAsync()).ReturnsAsync(true);

        _sut = new GatedCommitRedisStore(
            clientMock.Object,
            NullLogger<GatedCommitRedisStore>.Instance);
    }

    private static byte[] FlagValue(string id, long ts) =>
        Encoding.UTF8.GetBytes($"{{\"id\":\"{id}\",\"ts\":{ts}}}");

    private async Task SeedIndexAsync(Guid envId, string id, long score)
    {
        await _db.SortedSetAddAsync(RedisKeys.FlagIndex(envId), id, score);
    }

    [DockerFact]
    public async Task GetFlagsAsync_ByEnv_ReturnsCommittedVersion_NotUncommittedStaged()
    {
        // Arrange — gated path: two staged versions, pointer at 2000, index score 2000.
        var envId = Guid.NewGuid();
        var id = Guid.NewGuid().ToString();

        await _db.StringSetAsync(RedisKeys.FlagVersion(id, 1000), FlagValue(id, 1000));
        await _db.StringSetAsync(RedisKeys.FlagVersion(id, 2000), FlagValue(id, 2000));
        await _db.StringSetAsync(RedisKeys.FlagCommittedPointer(id), "2000");
        await SeedIndexAsync(envId, id, 2000);

        // Act — should resolve the pointer to v2000.
        var committed = (await _sut.GetFlagsAsync(envId, 0)).ToList();

        // Assert
        Assert.Single(committed);
        Assert.Equal(FlagValue(id, 2000), committed[0]);

        // Arrange — stage a newer v3000 WITHOUT moving the pointer.
        await _db.StringSetAsync(RedisKeys.FlagVersion(id, 3000), FlagValue(id, 3000));

        // Act — must still return committed v2000, never the uncommitted staged v3000.
        var stillCommitted = (await _sut.GetFlagsAsync(envId, 0)).ToList();

        // Assert
        Assert.Single(stillCommitted);
        Assert.Equal(FlagValue(id, 2000), stillCommitted[0]);
    }

    [DockerFact]
    public async Task GetFlagsAsync_ByEnv_FallsBackToMainKey_WhenNoPointer()
    {
        // Arrange — BestEffort path: only the legacy main key + index, no pointer.
        var envId = Guid.NewGuid();
        var id = Guid.NewGuid().ToString();
        var mainValue = FlagValue(id, 500);

        await _db.StringSetAsync(RedisKeys.Flag(id), mainValue);
        await SeedIndexAsync(envId, id, 500);

        // Act
        var result = (await _sut.GetFlagsAsync(envId, 0)).ToList();

        // Assert — unchanged behavior: returns the main-key value.
        Assert.Single(result);
        Assert.Equal(mainValue, result[0]);
    }

    [DockerFact]
    public async Task GetFlagsAsync_ByIds_ReturnsCommittedVersion_NotUncommittedStaged()
    {
        // Arrange
        var id = Guid.NewGuid().ToString();

        await _db.StringSetAsync(RedisKeys.FlagVersion(id, 1000), FlagValue(id, 1000));
        await _db.StringSetAsync(RedisKeys.FlagVersion(id, 2000), FlagValue(id, 2000));
        await _db.StringSetAsync(RedisKeys.FlagCommittedPointer(id), "2000");
        await _db.StringSetAsync(RedisKeys.FlagVersion(id, 3000), FlagValue(id, 3000));

        // Act
        var result = (await _sut.GetFlagsAsync(new[] { id })).ToList();

        // Assert — committed v2000, not staged v3000.
        Assert.Single(result);
        Assert.Equal(FlagValue(id, 2000), result[0]);
    }

    [DockerFact]
    public async Task GetFlagsAsync_ByIds_FallsBackToMainKey_WhenNoPointer()
    {
        // Arrange
        var id = Guid.NewGuid().ToString();
        var mainValue = FlagValue(id, 500);
        await _db.StringSetAsync(RedisKeys.Flag(id), mainValue);

        // Act
        var result = (await _sut.GetFlagsAsync(new[] { id })).ToList();

        // Assert
        Assert.Single(result);
        Assert.Equal(mainValue, result[0]);
    }

    public Task DisposeAsync()
    {
        _connection?.Dispose();
        return Task.CompletedTask;
    }
}
