using System.ComponentModel.DataAnnotations;

namespace Infrastructure.Caches.Redis;

public class RedisOptions
{
    public const string Redis = nameof(Redis);

    [Required(ErrorMessage = "Redis connection string must be set.")]
    public string ConnectionString { get; set; } = string.Empty;

    public string Password { get; set; } = string.Empty;

    /// <summary>
    /// Lock TTL (seconds) used by <see cref="RedisPopulatingService"/> when taking the
    /// <c>featbit:populate-redis</c> lock at startup. The lock prevents multiple back-end
    /// instances from running the Redis populate concurrently. Default is 5 seconds for
    /// backwards compatibility; production deployments with larger data sets should set this
    /// to a value greater than the expected populate duration to avoid concurrent populates
    /// from instances that arrive after the lock has expired.
    /// </summary>
    [Range(1, 3600, ErrorMessage = "Populate lock TTL must be between 1 and 3600 seconds.")]
    public int PopulateLockTtlSeconds { get; set; } = 5;

    /// <summary>
    /// Maximum number of seconds an instance will wait for another instance to finish
    /// populating Redis before throwing. Instances that arrive while a populate is in progress
    /// poll the populate marker and re-attempt the lock; if the populating instance is stuck
    /// or crashed past this timeout, the waiting instance throws so the host can surface the
    /// failure (and the orchestrator can restart it) rather than serving against a partially
    /// populated Redis indefinitely. Default is 180 seconds (3 minutes), which is a small
    /// multiple of the default lock TTL.
    /// </summary>
    [Range(1, 3600, ErrorMessage = "Populate max wait must be between 1 and 3600 seconds.")]
    public int PopulateMaxWaitSeconds { get; set; } = 180;
}