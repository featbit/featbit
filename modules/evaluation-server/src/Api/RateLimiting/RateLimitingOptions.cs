using System.ComponentModel.DataAnnotations;
using System.Threading.RateLimiting;

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
public sealed class RateLimitingOptions
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
    /// Per-endpoint rate limit overrides, keyed by policy name.
    /// Any property omitted from an endpoint entry inherits from the global defaults defined on this class.
    /// </summary>
    /// <remarks>
    /// Supported keys correspond to the policy names defined in <see cref="RateLimitingPolicies"/>.
    /// The dictionary is case-insensitive, so keys such as <c>"sdk"</c> or <c>"SDK"</c> are matched correctly.
    /// <para>Example (appsettings.json):</para>
    /// <code>
    /// "RateLimiting": {
    ///   "Endpoints": {
    ///     "Sdk":       { "PermitLimit": 500, "WindowSeconds": 30 },
    ///     "Streaming": { "Type": "TokenBucket", "TokenLimit": 200, "TokensPerPeriod": 50 }
    ///   }
    /// }
    /// </code>
    /// </remarks>
    public Dictionary<string, EndpointRateLimitOptions> Endpoints { get; set; } =
        new(StringComparer.OrdinalIgnoreCase);

    public override string ToString()
    {
        if (!Enabled)
        {
            return "RateLimiting: Disabled";
        }

        var sb = new System.Text.StringBuilder();
        sb.Append($"RateLimiting: Enabled | Distributed={Distributed} | Type={Type}");

        switch (Type)
        {
            case RateLimiterType.FixedWindow:
                sb.Append($" | PermitLimit={PermitLimit} | WindowSeconds={WindowSeconds}");
                break;
            case RateLimiterType.SlidingWindow:
                sb.Append($" | PermitLimit={PermitLimit} | WindowSeconds={WindowSeconds} | SegmentsPerWindow={SegmentsPerWindow}");
                break;
            case RateLimiterType.TokenBucket:
                sb.Append($" | TokenLimit={TokenLimit} | TokensPerPeriod={TokensPerPeriod} | ReplenishmentPeriodSeconds={ReplenishmentPeriodSeconds}");
                break;
        }

        if (QueueLimit > 0)
        {
            sb.Append($" | QueueLimit={QueueLimit}");
        }

        if (Endpoints.Count > 0)
        {
            sb.Append(" | Endpoints=[");
            sb.Append(string.Join(", ", Endpoints.Select(kvp => $"{kvp.Key}: {kvp.Value}")));
            sb.Append(']');
        }

        return sb.ToString();
    }
}

/// <summary>
/// Per-endpoint rate limit overrides. Properties left <c>null</c> inherit from the global defaults.
/// </summary>
public sealed class EndpointRateLimitOptions
{
    public RateLimiterType? Type { get; set; }
    public int? PermitLimit { get; set; }
    public int? WindowSeconds { get; set; }
    public int? QueueLimit { get; set; }
    public int? SegmentsPerWindow { get; set; }
    public int? TokenLimit { get; set; }
    public int? TokensPerPeriod { get; set; }
    public int? ReplenishmentPeriodSeconds { get; set; }

    public override string ToString()
    {
        var parts = new List<string>();
        if (Type.HasValue)
        {
            parts.Add($"Type={Type}");
        }

        if (PermitLimit.HasValue)
        {
            parts.Add($"PermitLimit={PermitLimit}");
        }

        if (WindowSeconds.HasValue)
        {
            parts.Add($"WindowSeconds={WindowSeconds}");
        }

        if (QueueLimit.HasValue)
        {
            parts.Add($"QueueLimit={QueueLimit}");
        }

        if (SegmentsPerWindow.HasValue)
        {
            parts.Add($"SegmentsPerWindow={SegmentsPerWindow}");
        }

        if (TokenLimit.HasValue)
        {
            parts.Add($"TokenLimit={TokenLimit}");
        }

        if (TokensPerPeriod.HasValue)
        {
            parts.Add($"TokensPerPeriod={TokensPerPeriod}");
        }

        if (ReplenishmentPeriodSeconds.HasValue)
        {
            parts.Add($"ReplenishmentPeriodSeconds={ReplenishmentPeriodSeconds}");
        }

        return string.Join(", ", parts);
    }
}

/// <summary>
/// Resolved/merged options ready for limiter construction.
/// </summary>
public sealed class EffectiveOptions
{
    public RateLimiterType Type { get; set; }
    public int PermitLimit { get; set; }
    public int WindowSeconds { get; set; }
    public int QueueLimit { get; set; }
    public int SegmentsPerWindow { get; set; }
    public int TokenLimit { get; set; }
    public int TokensPerPeriod { get; set; }
    public int ReplenishmentPeriodSeconds { get; set; }

    public EffectiveOptions(string policyName, RateLimitingOptions global)
    {
        Type = global.Type;
        PermitLimit = global.PermitLimit;
        WindowSeconds = global.WindowSeconds;
        QueueLimit = global.QueueLimit;
        SegmentsPerWindow = global.SegmentsPerWindow;
        TokenLimit = global.TokenLimit;
        TokensPerPeriod = global.TokensPerPeriod;
        ReplenishmentPeriodSeconds = global.ReplenishmentPeriodSeconds;

        if (global.Endpoints.TryGetValue(policyName, out var overwriteOptions))
        {
            Type = overwriteOptions.Type ?? Type;
            PermitLimit = overwriteOptions.PermitLimit ?? PermitLimit;
            WindowSeconds = overwriteOptions.WindowSeconds ?? WindowSeconds;
            QueueLimit = overwriteOptions.QueueLimit ?? QueueLimit;
            SegmentsPerWindow = overwriteOptions.SegmentsPerWindow ?? SegmentsPerWindow;
            TokenLimit = overwriteOptions.TokenLimit ?? TokenLimit;
            TokensPerPeriod = overwriteOptions.TokensPerPeriod ?? TokensPerPeriod;
            ReplenishmentPeriodSeconds = overwriteOptions.ReplenishmentPeriodSeconds ?? ReplenishmentPeriodSeconds;
        }
        
        switch (Type)
        {
            case RateLimiterType.FixedWindow or RateLimiterType.SlidingWindow when WindowSeconds < 1:
                throw new ArgumentOutOfRangeException(nameof(WindowSeconds), WindowSeconds, "Window must be at least 1 second.");
            case RateLimiterType.TokenBucket when ReplenishmentPeriodSeconds < 1:
                throw new ArgumentOutOfRangeException(
                    nameof(ReplenishmentPeriodSeconds),
                    ReplenishmentPeriodSeconds,
                    "Replenishment period must be at least 1 second."
                );
        }
    }

    public FixedWindowRateLimiterOptions ToFixedWindowOptions() => new()
    {
        PermitLimit = PermitLimit,
        Window = TimeSpan.FromSeconds(WindowSeconds),
        QueueLimit = QueueLimit
    };

    public SlidingWindowRateLimiterOptions ToSlidingWindowOptions() => new()
    {
        PermitLimit = PermitLimit,
        Window = TimeSpan.FromSeconds(WindowSeconds),
        SegmentsPerWindow = SegmentsPerWindow,
        QueueLimit = QueueLimit
    };

    public TokenBucketRateLimiterOptions ToTokenBucketOptions() => new()
    {
        TokenLimit = TokenLimit,
        TokensPerPeriod = TokensPerPeriod,
        ReplenishmentPeriod = TimeSpan.FromSeconds(ReplenishmentPeriodSeconds),
        QueueLimit = QueueLimit
    };
}