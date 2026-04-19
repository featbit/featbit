using Application.Usages;

namespace Application.UnitTests.Usages;

public class UsageRecordAggregatorTests
{
    private static readonly Guid EnvId1 = Guid.Parse("00000000-0000-0000-0000-000000000001");
    private static readonly Guid EnvId2 = Guid.Parse("00000000-0000-0000-0000-000000000002");
    private static readonly DateOnly Today = new DateOnly(2026, 4, 14);
    private static readonly DateOnly Yesterday = new DateOnly(2026, 4, 13);

    [Fact]
    public void EmptyList()
    {
        var result = UsageRecordsAggregator.Aggregate([]);

        Assert.Empty(result);
    }

    [Fact]
    public void SingleRecord()
    {
        var record = new InsightsUsageRecord(EnvId1, Today, ["user1", "user2"], 10, 5);

        var result = UsageRecordsAggregator.Aggregate([record]);

        Assert.Single(result);
        var agg = result[0];
        Assert.Equal(Today, agg.RecordedAt);
        Assert.Equal(new HashSet<string> { "user1", "user2" }, agg.EndUsers[EnvId1]);
        Assert.Equal((10, 5), agg.Events[EnvId1]);
    }

    [Fact]
    public void MultipleRecordsSameDate()
    {
        var records = new List<UsageRecord>
        {
            new InsightsUsageRecord(EnvId1, Today, ["user1", "user2"], 10, 3),
            new InsightsUsageRecord(EnvId1, Today, ["user2", "user3"], 5, 2),
        };

        var result = UsageRecordsAggregator.Aggregate(records);

        Assert.Single(result);
        var agg = result[0];
        Assert.Equal(Today, agg.RecordedAt);
        Assert.Equal(new HashSet<string> { "user1", "user2", "user3" }, agg.EndUsers[EnvId1]);
        Assert.Equal((15, 5), agg.Events[EnvId1]);
    }

    [Fact]
    public void MultipleRecordsDifferentDates()
    {
        var records = new List<UsageRecord>
        {
            new InsightsUsageRecord(EnvId1, Today, ["user1"], 10, 2),
            new InsightsUsageRecord(EnvId1, Yesterday, ["user2"], 4, 1),
        };

        var result = UsageRecordsAggregator.Aggregate(records);

        Assert.Equal(2, result.Length);
        var todayAgg = result.Single(r => r.RecordedAt == Today);
        var yesterdayAgg = result.Single(r => r.RecordedAt == Yesterday);

        Assert.Equal(new HashSet<string> { "user1" }, todayAgg.EndUsers[EnvId1]);
        Assert.Equal((10, 2), todayAgg.Events[EnvId1]);

        Assert.Equal(new HashSet<string> { "user2" }, yesterdayAgg.EndUsers[EnvId1]);
        Assert.Equal((4, 1), yesterdayAgg.Events[EnvId1]);
    }

    [Fact]
    public void MultipleEnvsSameDate()
    {
        var records = new List<UsageRecord>
        {
            new InsightsUsageRecord(EnvId1, Today, ["user1"], 10, 1),
            new InsightsUsageRecord(EnvId2, Today, ["user2"], 20, 2),
        };

        var result = UsageRecordsAggregator.Aggregate(records);

        Assert.Single(result);

        var agg = result[0];
        Assert.Equal(new HashSet<string> { "user1" }, agg.EndUsers[EnvId1]);
        Assert.Equal((10, 1), agg.Events[EnvId1]);

        Assert.Equal(new HashSet<string> { "user2" }, agg.EndUsers[EnvId2]);
        Assert.Equal((20, 2), agg.Events[EnvId2]);
    }

    [Fact]
    public void DuplicateEndUsers()
    {
        var records = new List<UsageRecord>
        {
            new InsightsUsageRecord(EnvId1, Today, ["user1", "user1", "user2"], 5, 0),
            new InsightsUsageRecord(EnvId1, Today, ["user1"], 3, 0),
        };

        var result = UsageRecordsAggregator.Aggregate(records);

        Assert.Single(result);
        Assert.Equal(new HashSet<string> { "user1", "user2" }, result[0].EndUsers[EnvId1]);
    }

    [Fact]
    public void EnvWithNoEndUsers()
    {
        var record = new InsightsUsageRecord(EnvId1, Today, [], 7, 3);

        var result = UsageRecordsAggregator.Aggregate([record]);

        Assert.Single(result);
        Assert.Empty(result[0].EndUsers[EnvId1]);
        Assert.Equal((7, 3), result[0].Events[EnvId1]);
    }
}