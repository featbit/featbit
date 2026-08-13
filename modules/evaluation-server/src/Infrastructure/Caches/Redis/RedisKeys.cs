using StackExchange.Redis;

namespace Infrastructure.Caches.Redis;

public static class RedisKeys
{
    private const string FlagPrefix = "featbit:flag:";
    private const string FlagCommittedPrefix = "featbit:flag-committed:";
    private const string FlagIndexPrefix = "featbit:flag-index:";
    private const string SegmentPrefix = "featbit:segment:";
    private const string SegmentCommittedPrefix = "featbit:segment-committed:";
    private const string SegmentIndexPrefix = "featbit:segment-index:";
    private const string SecretPrefix = "featbit:secret:";
    private const string RateLimitPrefix = "featbit:rl:";

    public static RedisKey FlagIndex(Guid envId) => new($"{FlagIndexPrefix}{envId}");

    /// <summary>
    /// The glob pattern matching every per-env flag index key (<c>featbit:flag-index:*</c>),
    /// for use with Redis <c>SCAN</c> when enumerating envs that have a committed flag index.
    /// </summary>
    public static string FlagIndexScanPattern => ScanPattern(FlagIndexPrefix);

    /// <summary>
    /// Extracts the environment id from a flag index key (<c>featbit:flag-index:{envId}</c>),
    /// or <c>null</c> if the key does not match the expected shape.
    /// </summary>
    public static Guid? TryParseFlagIndexEnvId(string key) => TryParseIndexEnvId(key, FlagIndexPrefix);

    public static RedisKey Flag(string id) => new($"{FlagPrefix}{id}");

    // --- Stage/commit read keys (mirror back-end RedisCaches B1 conventions) ---------------------
    // The back-end gated commit path writes a per-version snapshot under a versioned key derived
    // from the flag value key, plus a committed-pointer key recording the authoritative version:
    //   featbit:flag:{id}:v{ts}        -- immutable per-version snapshot ("staged" value)
    //   featbit:flag-committed:{id}    -- value is the committed timestamp ({ts}) as a string
    // GatedCommitRedisStore reads the pointer to resolve which versioned value is authoritative; when the
    // pointer is absent it falls back to the legacy single-value Flag key (BestEffort path).

    /// <summary>
    /// The versioned, immutable value key for a single staged flag version: <c>featbit:flag:{id}:v{ts}</c>.
    /// </summary>
    public static RedisKey FlagVersion(string id, long ts) => new($"{FlagPrefix}{id}:v{ts}");

    /// <summary>
    /// The committed-pointer key holding the timestamp of the currently committed flag version:
    /// <c>featbit:flag-committed:{id}</c>.
    /// </summary>
    public static RedisKey FlagCommittedPointer(string id) => new($"{FlagCommittedPrefix}{id}");

    public static RedisKey SegmentIndex(Guid envId) => new($"{SegmentIndexPrefix}{envId}");

    /// <summary>
    /// The glob pattern matching every per-env segment index key (<c>featbit:segment-index:*</c>),
    /// for use with Redis <c>SCAN</c> when enumerating envs that have a committed segment index.
    /// </summary>
    public static string SegmentIndexScanPattern => ScanPattern(SegmentIndexPrefix);

    /// <summary>
    /// Extracts the environment id from a segment index key (<c>featbit:segment-index:{envId}</c>),
    /// or <c>null</c> if the key does not match the expected shape.
    /// </summary>
    public static Guid? TryParseSegmentIndexEnvId(string key) => TryParseIndexEnvId(key, SegmentIndexPrefix);

    public static RedisKey Segment(string id) => new($"{SegmentPrefix}{id}");

    // --- Stage/commit read keys (mirror back-end RedisCaches B2 conventions) ---------------------
    // The back-end gated segment commit path writes a per-version snapshot under a versioned key
    // derived from the segment value key, plus a committed-pointer key recording the authoritative
    // version:
    //   featbit:segment:{id}:v{ts}        -- immutable per-version snapshot ("staged" value)
    //   featbit:segment-committed:{id}    -- value is the committed timestamp ({ts}) as a string
    // GatedCommitRedisStore reads the pointer to resolve which versioned value is authoritative; when the
    // pointer is absent it falls back to the legacy single-value Segment key (BestEffort path).

    /// <summary>
    /// The versioned, immutable value key for a single staged segment version:
    /// <c>featbit:segment:{id}:v{ts}</c>.
    /// </summary>
    public static RedisKey SegmentVersion(string id, long ts) => new($"{SegmentPrefix}{id}:v{ts}");

    /// <summary>
    /// The committed-pointer key holding the timestamp of the currently committed segment version:
    /// <c>featbit:segment-committed:{id}</c>.
    /// </summary>
    public static RedisKey SegmentCommittedPointer(string id) => new($"{SegmentCommittedPrefix}{id}");

    public static RedisKey Secret(string secretString) => new($"{SecretPrefix}{secretString}");

    public static RedisKey RateLimit(string type, string partitionKey) => new($"{RateLimitPrefix}{type}:{partitionKey}");

    // --- Shared index scan-pattern / TryParse helpers ---------------------------------------------
    // The flag-index and segment-index keys share the exact same "prefix + env-id" shape (only the
    // prefix differs), so the SCAN-pattern and TryParse logic above is factored into these two
    // helpers rather than duplicated per resource type (#108 item 3).

    /// <summary>
    /// The glob pattern matching every key under <paramref name="prefix"/>, for use with Redis
    /// <c>SCAN</c>.
    /// </summary>
    private static string ScanPattern(string prefix) => $"{prefix}*";

    /// <summary>
    /// Extracts the environment id from a <paramref name="prefix"/>-prefixed index key
    /// (<c>{prefix}{envId}</c>), or <c>null</c> if <paramref name="key"/> does not match the
    /// expected shape.
    /// </summary>
    private static Guid? TryParseIndexEnvId(string key, string prefix)
        => key.StartsWith(prefix, StringComparison.Ordinal)
           && Guid.TryParse(key.AsSpan(prefix.Length), out var envId)
            ? envId
            : null;
}