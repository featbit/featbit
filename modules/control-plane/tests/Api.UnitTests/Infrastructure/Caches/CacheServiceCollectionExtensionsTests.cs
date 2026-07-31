using Api.Infrastructure.Caches;

namespace Api.UnitTests.Infrastructure.Caches;

/// <summary>
/// #92 unit coverage for <see cref="CacheServiceCollectionExtensions.AppendRedisTimeouts"/>: the
/// per-DC connection-string builder that appends explicit <c>connectTimeout</c>/<c>syncTimeout</c> so
/// a command to a down DC fails fast instead of waiting StackExchange.Redis's own (much longer)
/// default. Exercised directly (no DI / real Redis needed) via the <c>InternalsVisibleTo</c> the
/// control-plane Api project already grants Api.UnitTests.
/// </summary>
public class CacheServiceCollectionExtensionsTests
{
    [Fact]
    public void AppendsBothTimeouts_WhenAbsent()
    {
        var result = CacheServiceCollectionExtensions.AppendRedisTimeouts("redis-west:6379", 1500, 1500);

        Assert.Equal("redis-west:6379,connectTimeout=1500,syncTimeout=1500", result);
    }

    [Fact]
    public void PreservesExistingConnectTimeout_OnlyAppendsSyncTimeout()
    {
        var result = CacheServiceCollectionExtensions.AppendRedisTimeouts(
            "redis-west:6379,connectTimeout=9000", 1500, 1500);

        Assert.Equal("redis-west:6379,connectTimeout=9000,syncTimeout=1500", result);
        Assert.Equal(1, CountOccurrences(result, "connectTimeout="));
    }

    [Fact]
    public void PreservesExistingSyncTimeout_OnlyAppendsConnectTimeout()
    {
        var result = CacheServiceCollectionExtensions.AppendRedisTimeouts(
            "redis-west:6379,syncTimeout=9000", 1500, 1500);

        Assert.Equal("redis-west:6379,syncTimeout=9000,connectTimeout=1500", result);
        Assert.Equal(1, CountOccurrences(result, "syncTimeout="));
    }

    [Fact]
    public void PreservesBoth_WhenBothAlreadyPresent()
    {
        const string connStr = "redis-west:6379,connectTimeout=2000,syncTimeout=3000";

        var result = CacheServiceCollectionExtensions.AppendRedisTimeouts(connStr, 1500, 1500);

        Assert.Equal(connStr, result);
    }

    [Fact]
    public void OptionMatch_IsCaseInsensitive()
    {
        var result = CacheServiceCollectionExtensions.AppendRedisTimeouts(
            "redis-west:6379,CONNECTTIMEOUT=2000,SyncTimeout=3000", 1500, 1500);

        Assert.Equal("redis-west:6379,CONNECTTIMEOUT=2000,SyncTimeout=3000", result);
    }

    [Fact]
    public void UsesConfiguredDefaults_NotHardcodedValues()
    {
        var result = CacheServiceCollectionExtensions.AppendRedisTimeouts("redis-west:6379", 750, 2500);

        Assert.Equal("redis-west:6379,connectTimeout=750,syncTimeout=2500", result);
    }

    [Fact]
    public void MultiHostSentinelStyleConnectionString_AppendsAfterAllHostsAndExistingOptions()
    {
        // Sentinel-style: several comma-separated host:port endpoints followed by options.
        const string sentinel = "sentinel-1:26379,sentinel-2:26379,sentinel-3:26379,serviceName=mymaster,abortConnect=false";

        var result = CacheServiceCollectionExtensions.AppendRedisTimeouts(sentinel, 1500, 1500);

        Assert.Equal(
            "sentinel-1:26379,sentinel-2:26379,sentinel-3:26379,serviceName=mymaster,abortConnect=false," +
            "connectTimeout=1500,syncTimeout=1500",
            result);
    }

    [Fact]
    public void MultiHostConnectionString_WithTimeoutAlreadyPresentAmongTheHosts_IsNotDuplicated()
    {
        const string sentinel =
            "sentinel-1:26379,sentinel-2:26379,serviceName=mymaster,connectTimeout=5000,abortConnect=false";

        var result = CacheServiceCollectionExtensions.AppendRedisTimeouts(sentinel, 1500, 1500);

        Assert.Equal(
            "sentinel-1:26379,sentinel-2:26379,serviceName=mymaster,connectTimeout=5000,abortConnect=false," +
            "syncTimeout=1500",
            result);
        Assert.Equal(1, CountOccurrences(result, "connectTimeout="));
    }

    private static int CountOccurrences(string haystack, string needle) =>
        haystack.Split(needle).Length - 1;
}
