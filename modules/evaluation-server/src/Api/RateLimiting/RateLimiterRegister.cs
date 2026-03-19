using System.Threading.RateLimiting;
using Domain.Shared;
using Infrastructure;
using Infrastructure.Caches;
using Infrastructure.Caches.Redis;
using Serilog;
using Streaming;

namespace Api.RateLimiting;

public static class RateLimiterRegister
{
    /// <summary>
    /// Registers rate limiting services and policies when <see cref="RateLimitingOptions.Enabled"/> is <c>true</c>.
    /// </summary>
    public static WebApplicationBuilder AddRateLimiting(this WebApplicationBuilder builder)
    {
        var configuration = builder.Configuration;

        // Validate options on startup to fail fast if misconfigured
        builder.Services
            .AddOptionsWithValidateOnStart<RateLimitingOptions>()
            .Bind(configuration.GetSection(RateLimitingOptions.SectionName))
            .ValidateDataAnnotations();

        var options = new RateLimitingOptions();
        configuration.GetSection(RateLimitingOptions.SectionName).Bind(options);

        // Log the rate limiting configuration on startup for visibility
        Log.Information("Rate limiting is enabled with the following configuration: {RateLimitingOptions}", options);

        var useDistributed = options.Distributed && configuration.GetCacheProvider() == CacheProvider.Redis;

        builder.Services.AddRateLimiter(limiterOptions =>
        {
            limiterOptions.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

            limiterOptions.OnRejected = async (context, cancellationToken) =>
            {
                // Log the rejection with EnvId and request path for monitoring and troubleshooting.
                var logger = context.HttpContext.RequestServices
                    .GetRequiredService<ILoggerFactory>()
                    .CreateLogger("Api.RateLimiting");

                var envId = ResolveEnvId(context.HttpContext);
                logger.LogWarning(
                    "Rate limit exceeded for EnvId {EnvId} on {Path}",
                    envId,
                    context.HttpContext.Request.Path
                );

                var response = context.HttpContext.Response;

                // Set Retry-After only when the lease carries the value.
                // The Redis limiter and the built-in FixedWindow/TokenBucket limiters
                // always populate this metadata on rejection.
                // The built-in SlidingWindowRateLimiter does not, so we omit the header
                // rather than emitting a potentially incorrect value from the global config
                // (which wouldn't reflect per-endpoint WindowSeconds overrides).
                if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
                {
                    response.Headers.RetryAfter = ((int)retryAfter.TotalSeconds).ToString();
                }

                await response.WriteAsJsonAsync(
                    new { error = "Rate limit exceeded. Please try again later." },
                    cancellationToken
                );
            };

            // Named policies for HTTP controller endpoints
            foreach (var policyName in RateLimitingPolicies.ControllerPolicies)
            {
                limiterOptions.AddPolicy(
                    policyName,
                    httpContext => CreatePartition(httpContext, policyName, options, useDistributed)
                );
            }

            // The `/streaming` request is served by custom middleware, not a routed endpoint. So we detect it here and
            // apply the limiter, while all other non-streaming requests bypass global rate limiting entirely.
            limiterOptions.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(httpContext =>
                StreamingHelper.IsStreamingRequest(httpContext)
                    ? CreatePartition(httpContext, RateLimitingPolicies.Streaming, options, useDistributed)
                    : RateLimitPartition.GetNoLimiter(string.Empty)
            );
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

        var effective = new EffectiveOptions(policyName, globalOptions);

        if (useDistributed)
        {
            return RateLimitPartition.Get(partitionKey, key =>
            {
                var redisClient = httpContext.RequestServices.GetRequiredService<IRedisClient>();

                var logger = httpContext.RequestServices
                    .GetRequiredService<ILoggerFactory>()
                    .CreateLogger<RedisRateLimiter>();

                return new RedisRateLimiter(redisClient, key, effective, logger);
            });
        }

        // In-memory rate limiting (per-instance)
        var partition = effective.Type switch
        {
            RateLimiterType.FixedWindow =>
                RateLimitPartition.GetFixedWindowLimiter(partitionKey, _ => effective.ToFixedWindowOptions()),
            RateLimiterType.SlidingWindow =>
                RateLimitPartition.GetSlidingWindowLimiter(partitionKey, _ => effective.ToSlidingWindowOptions()),
            RateLimiterType.TokenBucket =>
                RateLimitPartition.GetTokenBucketLimiter(partitionKey, _ => effective.ToTokenBucketOptions()),
            _ => throw new InvalidOperationException($"Unknown rate limiter type: {effective.Type}")
        };

        return partition;
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
        if (!string.IsNullOrWhiteSpace(tokenString))
        {
            var token = new Token(tokenString.AsSpan());
            if (token.IsValid && Secret.TryParse(token.SecretString, out var streamEnvId))
            {
                return streamEnvId;
            }
        }

        return Guid.Empty;
    }
}