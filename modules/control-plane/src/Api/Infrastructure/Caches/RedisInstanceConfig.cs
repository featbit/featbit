namespace Api.Infrastructure.Caches;

public class RedisInstanceConfig
{
    public string ConnectionString { get; set; } = "";

    public string? Password { get; set; }

    /// <summary>
    /// Identifier of the data center this Redis instance belongs to. Used to key
    /// per-instance broadcast results so a future commit coordinator can map stage
    /// results back to DCs. When empty, the instance's ordinal index is used as a
    /// fallback key (and a warning is logged).
    /// </summary>
    public string DcId { get; set; } = "";

    /// <summary>
    /// Optional region label for the data center (informational only).
    /// </summary>
    public string? Region { get; set; }
}
