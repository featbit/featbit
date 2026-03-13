using System.Threading.RateLimiting;
using Api.RateLimiting;
using Domain.Shared;
using Infrastructure;
using Infrastructure.Caches;
using Infrastructure.Caches.Redis;

namespace Api.Setup;

public static class RateLimiterRegister
{
    /// <summary>
    /// Named policies that map to SDK-facing controllers and the streaming endpoint.
    /// </summary>
    public static readonly string[] PolicyNames = ["Sdk", "Insight", "FeatureFlag", "Agent", "Streaming"];

    /// <summary>
    /// Registers rate limiting services and policies when <see cref="RateLimitingOptions.Enabled"/> is <c>true</c>.
    /// </summary>
    public static WebApplicationBuilder AddRateLimiting(this WebApplicationBuilder builder)
    {
        var configuration = builder.Configuration;

        builder.Services.Configure<RateLimitingOptions>(
            configuration.GetSection(RateLimitingOptions.SectionName));

        // Bind options early to decide whether to wire up the middleware
        var options = new RateLimitingOptions();
        configuration.GetSection(RateLimitingOptions.SectionName).Bind(options);

        if (!options.Enabled)
        {
            return builder;
        }

        var useDistributed = options.Distributed &&
                             configuration.GetCacheProvider() == CacheProvider.Redis;

        builder.Services.AddRateLimiter(limiterOptions =>
        {
            limiterOptions.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

            limiterOptions.OnRejected = async (context, cancellationToken) =>
            {
                var logger = context.HttpContext.RequestServices
                    .GetRequiredService<ILoggerFactory>()
                    .CreateLogger("RateLimiting");

                var envId = ResolveEnvId(context.HttpContext);
                logger.LogWarning(
                    "Rate limit exceeded for EnvId {EnvId} on {Path}",
                    envId,
                    context.HttpContext.Request.Path);

                context.HttpContext.Response.ContentType = "application/json";

                if (context.Lease.TryGetMetadata(
                        RedisRateLimitLease.RetryAfterMetadataName, out var retryAfterObj)
                    && retryAfterObj is TimeSpan retryAfter)
                {
                    context.HttpContext.Response.Headers.RetryAfter =
                        ((int)retryAfter.TotalSeconds).ToString();
                }

                await context.HttpContext.Response.WriteAsJsonAsync(
                    new { error = "Rate limit exceeded. Please try again later." },
                    cancellationToken);
            };

            // Named policies for HTTP controller endpoints
            foreach (var policyName in PolicyNames)
            {
                if (policyName == "Streaming")
                {
                    // Streaming is handled via the GlobalLimiter below because
                    // /streaming is served by custom middleware, not a routed endpoint.
                    continue;
                }

                var captured = policyName; // capture for closure
                limiterOptions.AddPolicy(captured, httpContext =>
                    CreatePartition(httpContext, captured, options, useDistributed));
            }

            // Global limiter catches the /streaming WebSocket upgrade path.
            // Non-streaming requests pass through without any global limit.
            limiterOptions.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(httpContext =>
            {
                if (!httpContext.Request.Path.StartsWithSegments("/streaming"))
                {
                    return RateLimitPartition.GetNoLimiter(string.Empty);
                }

                return CreatePartition(httpContext, "Streaming", options, useDistributed);
            });
        });

        return builder;
    }

    /// <summary>
    /// Creates a <see cref="RateLimitPartition{TKey}"/> for the given policy,
    /// using either in-memory or Redis-backed limiter based on configuration.
    /// </summary>
    private static RateLimitPartition<string> CreatePartition(
        HttpContext httpContext,
        string policyName,
        RateLimitingOptions globalOptions,
        bool useDistributed)
    {
        var envId = ResolveEnvId(httpContext);
        var partitionKey = $"{policyName}:{envId}";

        var effective = ResolveEffective(policyName, globalOptions);

        if (useDistributed)
        {
            return RateLimitPartition.Get(partitionKey, key =>
            {
                var redisClient = httpContext.RequestServices.GetRequiredService<IRedisClient>();
                return new RedisRateLimiter(
                    redisClient,
                    key,
                    effective.Type,
                    effective.PermitLimit,
                    TimeSpan.FromSeconds(effective.WindowSeconds),
                    effective.TokenLimit,
                    effective.TokensPerPeriod,
                    TimeSpan.FromSeconds(effective.ReplenishmentPeriodSeconds));
            });
        }

        // In-memory rate limiting (per-instance)
        return effective.Type switch
        {
            RateLimiterType.FixedWindow => RateLimitPartition.GetFixedWindowLimiter(
                partitionKey, _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = effective.PermitLimit,
                    Window = TimeSpan.FromSeconds(effective.WindowSeconds),
                    QueueLimit = effective.QueueLimit
                }),

            RateLimiterType.SlidingWindow => RateLimitPartition.GetSlidingWindowLimiter(
                partitionKey, _ => new SlidingWindowRateLimiterOptions
                {
                    PermitLimit = effective.PermitLimit,
                    Window = TimeSpan.FromSeconds(effective.WindowSeconds),
                    SegmentsPerWindow = effective.SegmentsPerWindow,
                    QueueLimit = effective.QueueLimit
                }),

            RateLimiterType.TokenBucket => RateLimitPartition.GetTokenBucketLimiter(
                partitionKey, _ => new TokenBucketRateLimiterOptions
                {
                    TokenLimit = effective.TokenLimit,
                    TokensPerPeriod = effective.TokensPerPeriod,
                    ReplenishmentPeriod = TimeSpan.FromSeconds(effective.ReplenishmentPeriodSeconds),
                    QueueLimit = effective.QueueLimit
                }),

            _ => throw new InvalidOperationException($"Unknown rate limiter type: {effective.Type}")
        };
    }

    /// <summary>
    /// Extracts the <c>EnvId</c> from the request.
    /// HTTP controllers: parsed from the <c>Authorization</c> header.
    /// WebSocket streaming: decoded from the <c>token</c> query parameter.
    /// </summary>
    private static Guid ResolveEnvId(HttpContext httpContext)
    {
        // HTTP controllers use the Authorization header directly
        string? secretString = httpContext.Request.Headers.Authorization;
        if (Secret.TryParse(secretString, out var envId))
        {
            return envId;
        }

        // WebSocket streaming encodes the secret inside the token query parameter
        var tokenString = httpContext.Request.Query["token"].ToString();
        if (!string.IsNullOrEmpty(tokenString))
        {
            var token = new Token(tokenString.AsSpan());
            if (token.IsValid && Secret.TryParse(token.SecretString, out var streamEnvId))
            {
                return streamEnvId;
            }
        }

        return Guid.Empty;
    }

    /// <summary>
    /// Merges per-endpoint overrides over global defaults to produce effective settings.
    /// </summary>
    private static EffectiveOptions ResolveEffective(
        string policyName,
        RateLimitingOptions global)
    {
        var effective = new EffectiveOptions
        {
            Type = global.Type,
            PermitLimit = global.PermitLimit,
            WindowSeconds = global.WindowSeconds,
            QueueLimit = global.QueueLimit,
            SegmentsPerWindow = global.SegmentsPerWindow,
            TokenLimit = global.TokenLimit,
            TokensPerPeriod = global.TokensPerPeriod,
            ReplenishmentPeriodSeconds = global.ReplenishmentPeriodSeconds
        };

        if (global.Endpoints.TryGetValue(policyName, out var ep))
        {
            effective.Type = ep.Type ?? effective.Type;
            effective.PermitLimit = ep.PermitLimit ?? effective.PermitLimit;
            effective.WindowSeconds = ep.WindowSeconds ?? effective.WindowSeconds;
            effective.QueueLimit = ep.QueueLimit ?? effective.QueueLimit;
            effective.SegmentsPerWindow = ep.SegmentsPerWindow ?? effective.SegmentsPerWindow;
            effective.TokenLimit = ep.TokenLimit ?? effective.TokenLimit;
            effective.TokensPerPeriod = ep.TokensPerPeriod ?? effective.TokensPerPeriod;
            effective.ReplenishmentPeriodSeconds = ep.ReplenishmentPeriodSeconds ?? effective.ReplenishmentPeriodSeconds;
        }

        return effective;
    }

    /// <summary>
    /// Resolved/merged options ready for limiter construction.
    /// </summary>
    private sealed class EffectiveOptions
    {
        public RateLimiterType Type { get; set; }
        public int PermitLimit { get; set; }
        public int WindowSeconds { get; set; }
        public int QueueLimit { get; set; }
        public int SegmentsPerWindow { get; set; }
        public int TokenLimit { get; set; }
        public int TokensPerPeriod { get; set; }
        public int ReplenishmentPeriodSeconds { get; set; }
    }
}
