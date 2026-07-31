using StackExchange.Redis;

namespace Infrastructure.Caches.Redis;

public static class RedisKeys
{
    private const string FlagPrefix = "featbit:flag:";
    private const string FlagIndexPrefix = "featbit:flag-index:";
    private const string SegmentPrefix = "featbit:segment:";
    private const string SegmentIndexPrefix = "featbit:segment-index:";
    private const string LicensePrefix = "featbit:license:";
    private const string SecretPrefix = "featbit:secret:";
    private const string ConnectionPrefix = "featbit:connection:";
    private const string HeartbeatPrefix = "featbit:heartbeat:";
    private const string FlagCommittedPrefix = "featbit:flag-committed:";
    private const string SegmentCommittedPrefix = "featbit:segment-committed:";

    public static RedisKey License(Guid id) => new($"{LicensePrefix}{id}");

    public static RedisKey Flag(Guid id) => new($"{FlagPrefix}{id}");

    public static RedisKey FlagIndex(Guid envId) => new($"{FlagIndexPrefix}{envId}");

    public static RedisKey Segment(Guid id) => new($"{SegmentPrefix}{id}");

    public static RedisKey SegmentIndex(Guid envId) => new($"{SegmentIndexPrefix}{envId}");

    public static RedisKey Secret(string secretString) => new($"{SecretPrefix}{secretString}");

    public static RedisKey Connection(string connectionId) => new($"{ConnectionPrefix}{connectionId}");

    public static RedisKey Heartbeats => new($"{HeartbeatPrefix}all");

    public const string ConnectionPattern = $"{ConnectionPrefix}*";

    // --- B1 stage/commit storage -------------------------------------------------------------
    // To keep the old committed flag value readable while a new version is staged, a staged value
    // is written under a versioned key derived from the existing flag value key (RedisKeys.Flag):
    //   featbit:flag:{id}:v{ts}        -- immutable per-version snapshot ("staged" value)
    // A separate committed-pointer key records which version is currently authoritative:
    //   featbit:flag-committed:{id}    -- value is the committed timestamp ({ts}) as a string
    // Staging writes only the versioned key; committing flips the pointer (and the env index).
    // Both keys reuse the existing FlagPrefix convention so they share key-space ownership with
    // the legacy single-value key produced by RedisKeys.Flag.

    /// <summary>
    /// The committed-pointer key holding the timestamp of the currently committed flag version:
    /// <c>featbit:flag-committed:{id}</c>.
    /// </summary>
    public static RedisKey FlagCommittedPointer(Guid id) => new($"{FlagCommittedPrefix}{id}");

    /// <summary>
    /// The versioned, immutable value key for a single staged flag version: <c>featbit:flag:{id}:v{ts}</c>.
    /// </summary>
    public static RedisKey FlagVersion(Guid id, long ts) => new($"{Flag(id)}:v{ts}");

    /// <summary>
    /// SCAN match pattern selecting only versioned flag value keys.
    /// </summary>
    public const string VersionedFlagKeyPattern = "featbit:flag:*:v*";

    // --- B2 stage/commit storage (segment equivalents of B1) ---------------------------------
    // Mirrors the B1 flag stage/commit storage for segments so the old committed segment value
    // stays readable while a new version is staged:
    //   featbit:segment:{id}:v{ts}        -- immutable per-version snapshot ("staged" value)
    //   featbit:segment-committed:{id}    -- value is the committed timestamp ({ts}) as a string
    // Staging writes only the versioned key; committing flips the pointer (and the env index).
    // Both keys reuse the existing SegmentPrefix convention so they share key-space ownership with
    // the legacy single-value key produced by RedisKeys.Segment.

    /// <summary>
    /// The committed-pointer key holding the timestamp of the currently committed segment version:
    /// <c>featbit:segment-committed:{id}</c>.
    /// </summary>
    public static RedisKey SegmentCommittedPointer(Guid id) => new($"{SegmentCommittedPrefix}{id}");

    /// <summary>
    /// The versioned, immutable value key for a single staged segment version:
    /// <c>featbit:segment:{id}:v{ts}</c>.
    /// </summary>
    public static RedisKey SegmentVersion(Guid id, long ts) => new($"{Segment(id)}:v{ts}");
}