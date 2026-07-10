using System.Text;
using Infrastructure.Caches.Redis;
using Infrastructure.Store;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Testing;
using Moq;
using StackExchange.Redis;

namespace Infrastructure.UnitTests;

public class RedisStoreOrphanTests
{
    private readonly Mock<IRedisClient> _redisClient = new();
    private readonly Mock<IDatabase> _database = new();
    private readonly FakeLogger<RedisStore> _logger = new();
    private readonly Dictionary<RedisKey, RedisValue> _store = new();

    public RedisStoreOrphanTests()
    {
        _redisClient.Setup(x => x.GetDatabase()).Returns(_database.Object);

        _database
            .Setup(x => x.StringGetAsync(It.IsAny<RedisKey>(), It.IsAny<CommandFlags>()))
            .Returns((RedisKey key, CommandFlags _) =>
                Task.FromResult(_store.TryGetValue(key, out var v) ? v : RedisValue.Null));
    }

    private RedisStore CreateSut() => new(_redisClient.Object, _logger);

    [Fact]
    public async Task GetFlagsAsync_ByEnv_FiltersOrphansAndLogsWarning()
    {
        var envId = Guid.NewGuid();
        var presentId = "flag-present";
        var orphanId = "flag-orphan";

        _database
            .Setup(x => x.SortedSetRangeByScoreAsync(
                RedisKeys.FlagIndex(envId),
                It.IsAny<double>(), It.IsAny<double>(),
                It.IsAny<Exclude>(), It.IsAny<Order>(),
                It.IsAny<long>(), It.IsAny<long>(), It.IsAny<CommandFlags>()))
            .ReturnsAsync(new RedisValue[] { presentId, orphanId });

        var presentPayload = Encoding.UTF8.GetBytes("{\"id\":\"flag-present\"}");
        _store[RedisKeys.Flag(presentId)] = presentPayload;
        // orphan: no entry in _store -> StringGetAsync returns RedisValue.Null

        var result = (await CreateSut().GetFlagsAsync(envId, 0)).ToList();

        Assert.Single(result);
        Assert.Equal(presentPayload, result[0]);

        var record = Assert.Single(_logger.Collector.GetSnapshot());
        Assert.Equal(LogLevel.Warning, record.Level);
        Assert.Contains("Orphan flag index members", record.Message);
        Assert.Contains(envId.ToString(), record.Message);
        Assert.Contains(RedisKeys.Flag(orphanId).ToString(), record.Message);
    }

    [Fact]
    public async Task GetFlagsAsync_ByEnv_NoOrphans_DoesNotLog()
    {
        var envId = Guid.NewGuid();
        var id = "flag-1";

        _database
            .Setup(x => x.SortedSetRangeByScoreAsync(
                RedisKeys.FlagIndex(envId),
                It.IsAny<double>(), It.IsAny<double>(),
                It.IsAny<Exclude>(), It.IsAny<Order>(),
                It.IsAny<long>(), It.IsAny<long>(), It.IsAny<CommandFlags>()))
            .ReturnsAsync(new RedisValue[] { id });

        _store[RedisKeys.Flag(id)] = Encoding.UTF8.GetBytes("{\"id\":\"flag-1\"}");

        var result = (await CreateSut().GetFlagsAsync(envId, 0)).ToList();

        Assert.Single(result);
        Assert.Empty(_logger.Collector.GetSnapshot());
    }

    [Fact]
    public async Task GetFlagsAsync_ByIds_FiltersOrphansAndLogsWithoutEnv()
    {
        var presentId = "flag-present";
        var orphanId = "flag-orphan";

        var presentPayload = Encoding.UTF8.GetBytes("{\"id\":\"flag-present\"}");
        _store[RedisKeys.Flag(presentId)] = presentPayload;

        var result = (await CreateSut().GetFlagsAsync(new[] { presentId, orphanId })).ToList();

        Assert.Single(result);
        Assert.Equal(presentPayload, result[0]);

        var record = Assert.Single(_logger.Collector.GetSnapshot());
        Assert.Equal(LogLevel.Warning, record.Level);
        Assert.Contains("Orphan flag ids requested", record.Message);
        Assert.Contains(RedisKeys.Flag(orphanId).ToString(), record.Message);
    }

    [Fact]
    public async Task GetSegmentsAsync_FiltersOrphansAndLogsWarning()
    {
        var envId = Guid.NewGuid();
        var presentId = "segment-present";
        var orphanId = "segment-orphan";

        _database
            .Setup(x => x.SortedSetRangeByScoreAsync(
                RedisKeys.SegmentIndex(envId),
                It.IsAny<double>(), It.IsAny<double>(),
                It.IsAny<Exclude>(), It.IsAny<Order>(),
                It.IsAny<long>(), It.IsAny<long>(), It.IsAny<CommandFlags>()))
            .ReturnsAsync(new RedisValue[] { presentId, orphanId });

        var presentJson = "{\"id\":\"segment-present\",\"envId\":\"" + envId + "\"}";
        _store[RedisKeys.Segment(presentId)] = presentJson;

        var result = (await CreateSut().GetSegmentsAsync(envId, 0)).ToList();

        Assert.Single(result);
        Assert.Equal(presentJson, Encoding.UTF8.GetString(result[0]));

        var record = Assert.Single(_logger.Collector.GetSnapshot());
        Assert.Equal(LogLevel.Warning, record.Level);
        Assert.Contains("Orphan segment index members", record.Message);
        Assert.Contains(envId.ToString(), record.Message);
        Assert.Contains(RedisKeys.Segment(orphanId).ToString(), record.Message);
    }

    [Fact]
    public async Task GetSegmentsAsync_SharedSegment_RewritesEnvIdAndStillFiltersOrphans()
    {
        var envId = Guid.NewGuid();
        var sharedId = "segment-shared";
        var orphanId = "segment-orphan";

        _database
            .Setup(x => x.SortedSetRangeByScoreAsync(
                RedisKeys.SegmentIndex(envId),
                It.IsAny<double>(), It.IsAny<double>(),
                It.IsAny<Exclude>(), It.IsAny<Order>(),
                It.IsAny<long>(), It.IsAny<long>(), It.IsAny<CommandFlags>()))
            .ReturnsAsync(new RedisValue[] { sharedId, orphanId });

        // shared segments are persisted with an empty envId; the store rewrites it per-env on read.
        _store[RedisKeys.Segment(sharedId)] = "{\"id\":\"segment-shared\",\"envId\":\"\",\"name\":\"shared\"}";

        var result = (await CreateSut().GetSegmentsAsync(envId, 0)).ToList();

        Assert.Single(result);
        var rewritten = Encoding.UTF8.GetString(result[0]);
        Assert.Contains($"\"envId\":\"{envId}\"", rewritten);
        Assert.DoesNotContain("\"envId\":\"\"", rewritten);

        var record = Assert.Single(_logger.Collector.GetSnapshot());
        Assert.Equal(LogLevel.Warning, record.Level);
        Assert.Contains("Orphan segment index members", record.Message);
    }
}
