using System.ComponentModel.DataAnnotations;

namespace Api.RateLimiting;

/// <summary>
/// Supported rate limiter algorithm types.
/// </summary>
public enum RateLimiterType
{
    FixedWindow,
    SlidingWindow,
    TokenBucket
}

/// <summary>
/// Global rate limiting configuration. Bound from the "RateLimiting" configuration section.
/// </summary>
public class RateLimitingOptions
{
    public const string SectionName = "RateLimiting";

    /// <summary>
    /// Whether rate limiting is enabled. Defaults to <c>false</c>.
    /// </summary>
    public bool Enabled { get; set; } = false;

    /// <summary>
    /// Whether to use Redis for distributed rate limiting across multiple instances.
    /// Requires <c>CacheProvider</c> to be set to <c>"Redis"</c>.
    /// When <c>false</c>, an in-memory per-instance limiter is used.
    /// </summary>
    public bool Distributed { get; set; } = false;

    /// <summary>
    /// The rate limiter algorithm to use globally.
    /// Can be overridden per endpoint via <see cref="Endpoints"/>.
    /// </summary>
    public RateLimiterType Type { get; set; } = RateLimiterType.FixedWindow;

    // -- FixedWindow / SlidingWindow shared defaults --

    /// <summary>
    /// Maximum number of permits allowed in the time window.
    /// Used by <see cref="RateLimiterType.FixedWindow"/> and <see cref="RateLimiterType.SlidingWindow"/>.
    /// </summary>
    public int PermitLimit { get; set; } = 100;

    /// <summary>
    /// Time window length in seconds. Must be between 1 and 86400 (24 hours).
    /// Used by <see cref="RateLimiterType.FixedWindow"/> and <see cref="RateLimiterType.SlidingWindow"/>.
    /// </summary>
    [Range(1, 86_400, ErrorMessage = "WindowSeconds must be between 1 and 86400 (24 hours).")]
    public int WindowSeconds { get; set; } = 60;

    /// <summary>
    /// Maximum number of requests queued when the limit is reached.
    /// </summary>
    public int QueueLimit { get; set; } = 0;

    // -- SlidingWindow specific --

    /// <summary>
    /// Number of segments the window is divided into.
    /// Only used when <see cref="Type"/> is <see cref="RateLimiterType.SlidingWindow"/>.
    /// </summary>
    public int SegmentsPerWindow { get; set; } = 4;

    // -- TokenBucket specific --

    /// <summary>
    /// Maximum number of tokens in the bucket.
    /// Only used when <see cref="Type"/> is <see cref="RateLimiterType.TokenBucket"/>.
    /// </summary>
    public int TokenLimit { get; set; } = 100;

    /// <summary>
    /// Number of tokens added per replenishment period.
    /// Only used when <see cref="Type"/> is <see cref="RateLimiterType.TokenBucket"/>.
    /// </summary>
    public int TokensPerPeriod { get; set; } = 50;

    /// <summary>
    /// Time between token replenishments in seconds. Must be between 1 and 86400 (24 hours).
    /// Only used when <see cref="Type"/> is <see cref="RateLimiterType.TokenBucket"/>.
    /// </summary>
    [Range(1, 86_400, ErrorMessage = "ReplenishmentPeriodSeconds must be between 1 and 86400 (24 hours).")]
    public int ReplenishmentPeriodSeconds { get; set; } = 60;

    /// <summary>
    /// Per-endpoint overrides keyed by policy name.
    /// Supported keys: <c>"Sdk"</c>, <c>"Insight"</c>, <c>"FeatureFlag"</c>, <c>"Agent"</c>, <c>"Streaming"</c>.
    /// Any property left <c>null</c> inherits from the global default above.
    /// The dictionary is case-insensitive so JSON config using any casing (e.g. <c>"sdk"</c>) is matched correctly.
    /// </summary>
    public Dictionary<string, EndpointRateLimitOptions> Endpoints { get; set; } =
        new(StringComparer.OrdinalIgnoreCase);
}

/// <summary>
/// Per-endpoint rate limit overrides. Properties left <c>null</c> inherit from the global defaults.
/// </summary>
public class EndpointRateLimitOptions
{
    public RateLimiterType? Type { get; set; }
    public int? PermitLimit { get; set; }
    public int? WindowSeconds { get; set; }
    public int? QueueLimit { get; set; }
    public int? SegmentsPerWindow { get; set; }
    public int? TokenLimit { get; set; }
    public int? TokensPerPeriod { get; set; }
    public int? ReplenishmentPeriodSeconds { get; set; }
}
