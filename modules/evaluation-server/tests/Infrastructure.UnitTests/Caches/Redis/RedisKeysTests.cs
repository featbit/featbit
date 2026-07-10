using Infrastructure.Caches.Redis;

namespace Infrastructure.UnitTests.Caches.Redis;

public class RedisKeysTests
{
    [Fact]
    public void FlagIndex_FormatsAsFeatbitFlagIndexPrefixWithEnvIdSuffix()
    {
        var envId = Guid.Parse("11111111-1111-1111-1111-111111111111");

        var key = RedisKeys.FlagIndex(envId);

        Assert.Equal("featbit:flag-index:11111111-1111-1111-1111-111111111111", (string)key!);
    }

    [Fact]
    public void Flag_FormatsAsFeatbitFlagPrefixWithIdSuffix()
    {
        var key = RedisKeys.Flag("flag-1");

        Assert.Equal("featbit:flag:flag-1", (string)key!);
    }

    [Fact]
    public void SegmentIndex_FormatsAsFeatbitSegmentIndexPrefixWithEnvIdSuffix()
    {
        var envId = Guid.Parse("22222222-2222-2222-2222-222222222222");

        var key = RedisKeys.SegmentIndex(envId);

        Assert.Equal("featbit:segment-index:22222222-2222-2222-2222-222222222222", (string)key!);
    }

    [Fact]
    public void Segment_FormatsAsFeatbitSegmentPrefixWithIdSuffix()
    {
        var key = RedisKeys.Segment("seg-1");

        Assert.Equal("featbit:segment:seg-1", (string)key!);
    }

    [Fact]
    public void Secret_FormatsAsFeatbitSecretPrefixWithSecretSuffix()
    {
        var key = RedisKeys.Secret("the-secret");

        Assert.Equal("featbit:secret:the-secret", (string)key!);
    }

    [Fact]
    public void RateLimit_FormatsAsFeatbitRlPrefixWithTypeAndPartitionKey()
    {
        var key = RedisKeys.RateLimit("login", "alice");

        Assert.Equal("featbit:rl:login:alice", (string)key!);
    }
}
