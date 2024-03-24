using StackExchange.Redis;

namespace Infrastructure.Redis;

public static class RedisKeys
{
    private const string FlagPrefix = "featbit:flag:";
    private const string FlagIndexPrefix = "featbit:flag-index:";
    private const string SegmentPrefix = "featbit:segment:";
    private const string SegmentIndexPrefix = "featbit:segment-index:";
    private const string LicensePrefix = "featbit:license:";
    private const string SecretPrefix = "featbit:secret:";

    public static RedisKey License(Guid id) => new($"{LicensePrefix}{id}");

    public static RedisKey Flag(Guid id) => new($"{FlagPrefix}{id}");

    public static RedisKey FlagIndex(Guid envId) => new($"{FlagIndexPrefix}{envId}");

    public static RedisKey Segment(Guid id) => new($"{SegmentPrefix}{id}");

    public static RedisKey SegmentIndex(Guid envId) => new($"{SegmentIndexPrefix}{envId}");

    public static RedisKey Secret(string secretString) => new($"{SecretPrefix}{secretString}");
}