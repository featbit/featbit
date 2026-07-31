using Infrastructure.Caches.Redis;
using Xunit;

namespace Infrastructure.UnitTests.Caches.Redis;

/// <summary>
/// #106 unit coverage for <see cref="RedisClient.EnsureSelfHealingOptions"/>: the connection-string
/// normalizer that appends <c>abortConnect=false</c> (+ explicit <c>connectTimeout</c>/
/// <c>syncTimeout</c>) so a Redis outage at first touch doesn't permanently poison the
/// <c>Lazy&lt;ConnectionMultiplexer&gt;</c>. Ported from the control-plane template
/// (<c>CacheServiceCollectionExtensions.AppendRedisTimeouts</c>, #92). Exercised directly (no DI /
/// real Redis needed) via the <c>InternalsVisibleTo</c> the Infrastructure project grants
/// Infrastructure.UnitTests.
/// </summary>
public class RedisClientTests
{
    [Fact]
    public void AppendsAllThreeOptions_WhenAbsent()
    {
        var result = RedisClient.EnsureSelfHealingOptions("redis:6379", 1500, 1500);

        Assert.Equal("redis:6379,abortConnect=false,connectTimeout=1500,syncTimeout=1500", result);
    }

    [Fact]
    public void PreservesExplicitAbortConnect_DoesNotAppendAnother()
    {
        var result = RedisClient.EnsureSelfHealingOptions("redis:6379,abortConnect=true", 1500, 1500);

        Assert.Equal("redis:6379,abortConnect=true,connectTimeout=1500,syncTimeout=1500", result);
        Assert.Equal(1, CountOccurrences(result, "abortConnect="));
    }

    [Fact]
    public void PreservesExistingConnectTimeout_OnlyAppendsTheRest()
    {
        var result = RedisClient.EnsureSelfHealingOptions("redis:6379,connectTimeout=9000", 1500, 1500);

        Assert.Equal("redis:6379,connectTimeout=9000,abortConnect=false,syncTimeout=1500", result);
        Assert.Equal(1, CountOccurrences(result, "connectTimeout="));
    }

    [Fact]
    public void PreservesExistingSyncTimeout_OnlyAppendsTheRest()
    {
        var result = RedisClient.EnsureSelfHealingOptions("redis:6379,syncTimeout=9000", 1500, 1500);

        Assert.Equal("redis:6379,syncTimeout=9000,abortConnect=false,connectTimeout=1500", result);
        Assert.Equal(1, CountOccurrences(result, "syncTimeout="));
    }

    [Fact]
    public void PreservesAllThree_WhenAlreadyPresent()
    {
        const string connStr = "redis:6379,abortConnect=false,connectTimeout=2000,syncTimeout=3000";

        var result = RedisClient.EnsureSelfHealingOptions(connStr, 1500, 1500);

        Assert.Equal(connStr, result);
    }

    [Fact]
    public void OptionMatch_IsCaseInsensitive()
    {
        var result = RedisClient.EnsureSelfHealingOptions(
            "redis:6379,ABORTCONNECT=true,CONNECTTIMEOUT=2000,SyncTimeout=3000", 1500, 1500);

        Assert.Equal("redis:6379,ABORTCONNECT=true,CONNECTTIMEOUT=2000,SyncTimeout=3000", result);
    }

    [Fact]
    public void UsesConfiguredDefaults_NotHardcodedValues()
    {
        var result = RedisClient.EnsureSelfHealingOptions("redis:6379", 750, 2500);

        Assert.Equal("redis:6379,abortConnect=false,connectTimeout=750,syncTimeout=2500", result);
    }

    [Fact]
    public void MultiHostSentinelStyleConnectionString_AppendsAfterAllHostsAndExistingOptions()
    {
        // Sentinel-style: several comma-separated host:port endpoints followed by options.
        const string sentinel = "sentinel-1:26379,sentinel-2:26379,sentinel-3:26379,serviceName=mymaster";

        var result = RedisClient.EnsureSelfHealingOptions(sentinel, 1500, 1500);

        Assert.Equal(
            "sentinel-1:26379,sentinel-2:26379,sentinel-3:26379,serviceName=mymaster," +
            "abortConnect=false,connectTimeout=1500,syncTimeout=1500",
            result);
    }

    [Fact]
    public void MultiHostConnectionString_WithOptionsAlreadyPresentAmongTheHosts_IsNotDuplicated()
    {
        const string sentinel =
            "sentinel-1:26379,sentinel-2:26379,serviceName=mymaster,connectTimeout=5000,abortConnect=false";

        var result = RedisClient.EnsureSelfHealingOptions(sentinel, 1500, 1500);

        Assert.Equal(
            "sentinel-1:26379,sentinel-2:26379,serviceName=mymaster,connectTimeout=5000,abortConnect=false," +
            "syncTimeout=1500",
            result);
        Assert.Equal(1, CountOccurrences(result, "connectTimeout="));
        Assert.Equal(1, CountOccurrences(result, "abortConnect="));
    }

    [Fact]
    public void PreservesPasswordAndOtherOptions_AppendsAfterThem()
    {
        var result = RedisClient.EnsureSelfHealingOptions("redis:6379,password=xxx", 1500, 1500);

        Assert.Equal("redis:6379,password=xxx,abortConnect=false,connectTimeout=1500,syncTimeout=1500", result);
    }

    private static int CountOccurrences(string haystack, string needle) =>
        haystack.Split(needle).Length - 1;
}
