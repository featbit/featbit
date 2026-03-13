using System.Threading.RateLimiting;
using Infrastructure.Caches.Redis;
using StackExchange.Redis;

namespace Api.RateLimiting;

/// <summary>
/// A distributed <see cref="RateLimiter"/> backed by Redis using atomic Lua scripts.
/// Supports <see cref="RateLimiterType.FixedWindow"/>, <see cref="RateLimiterType.SlidingWindow"/>,
/// and <see cref="RateLimiterType.TokenBucket"/> algorithms.
/// When Redis is unreachable the limiter fails open (allows the request).
/// </summary>
public sealed class RedisRateLimiter : RateLimiter
{
    private readonly IRedisClient _redisClient;
    private readonly string _partitionKey;
    private readonly RateLimiterType _type;
    private readonly int _permitLimit;
    private readonly TimeSpan _window;
    private readonly int _tokenLimit;
    private readonly int _tokensPerPeriod;
    private readonly TimeSpan _replenishmentPeriod;
    private long _lastActivity = Environment.TickCount64;

    #region Lua scripts – executed atomically on Redis

    /// <summary>
    /// Fixed-window: increments a counter keyed by the current window slot.
    /// Returns remaining permits (positive) or negative retry-after seconds.
    /// </summary>
    private const string FixedWindowScript = """
        local key = KEYS[1]
        local limit = tonumber(ARGV[1])
        local window = tonumber(ARGV[2])
        local current = redis.call('INCR', key)
        if current == 1 then
            redis.call('EXPIRE', key, window)
        end
        if current > limit then
            local ttl = redis.call('TTL', key)
            return tostring(-ttl)
        end
        return tostring(limit - current)
        """;

    /// <summary>
    /// Sliding-window: uses a sorted set scored by timestamp.
    /// Removes expired entries, checks count, adds new entry if under limit.
    /// Returns remaining permits (positive) or negative retry-after seconds.
    /// </summary>
    private const string SlidingWindowScript = """
        local key = KEYS[1]
        local limit = tonumber(ARGV[1])
        local window = tonumber(ARGV[2])
        local now = tonumber(ARGV[3])
        local id = ARGV[4]
        local clearBefore = now - window
        redis.call('ZREMRANGEBYSCORE', key, 0, clearBefore)
        local count = redis.call('ZCARD', key)
        if count >= limit then
            local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
            if #oldest > 0 then
                local retryAfter = tonumber(oldest[2]) + window - now
                return tostring(-math.ceil(retryAfter))
            end
            return tostring(-window)
        end
        redis.call('ZADD', key, now, id)
        redis.call('EXPIRE', key, math.ceil(window) + 1)
        return tostring(limit - count - 1)
        """;

    /// <summary>
    /// Token-bucket: stores {tokens, last_refill} in a hash.
    /// Refills tokens based on elapsed time, then attempts to consume one.
    /// Returns remaining tokens (positive) or negative retry-after seconds.
    /// </summary>
    private const string TokenBucketScript = """
        local key = KEYS[1]
        local tokenLimit = tonumber(ARGV[1])
        local tokensPerPeriod = tonumber(ARGV[2])
        local replenishMs = tonumber(ARGV[3])
        local now = tonumber(ARGV[4])
        local requested = tonumber(ARGV[5])
        local bucket = redis.call('HMGET', key, 'tokens', 'last_refill')
        local tokens = tonumber(bucket[1])
        local lastRefill = tonumber(bucket[2])
        if tokens == nil then
            tokens = tokenLimit
            lastRefill = now
        end
        local elapsed = now - lastRefill
        if elapsed > 0 and replenishMs > 0 then
            local newTokens = math.floor(elapsed * tokensPerPeriod / replenishMs)
            if newTokens > 0 then
                tokens = math.min(tokenLimit, tokens + newTokens)
                lastRefill = lastRefill + math.floor(newTokens * replenishMs / tokensPerPeriod)
            end
        end
        if tokens >= requested then
            tokens = tokens - requested
            redis.call('HMSET', key, 'tokens', tokens, 'last_refill', lastRefill)
            local ttl = math.ceil(replenishMs * tokenLimit / tokensPerPeriod / 1000) + 60
            redis.call('EXPIRE', key, ttl)
            return tostring(tokens)
        else
            redis.call('HMSET', key, 'tokens', tokens, 'last_refill', lastRefill)
            local ttl = math.ceil(replenishMs * tokenLimit / tokensPerPeriod / 1000) + 60
            redis.call('EXPIRE', key, ttl)
            local deficit = requested - tokens
            local retryMs = math.ceil(deficit * replenishMs / tokensPerPeriod)
            return tostring(-math.ceil(retryMs / 1000))
        end
        """;

    #endregion

    public RedisRateLimiter(
        IRedisClient redisClient,
        string partitionKey,
        RateLimiterType type,
        int permitLimit,
        TimeSpan window,
        int tokenLimit,
        int tokensPerPeriod,
        TimeSpan replenishmentPeriod)
    {
        _redisClient = redisClient;
        _partitionKey = partitionKey;
        _type = type;
        _permitLimit = permitLimit;
        _window = window;
        _tokenLimit = tokenLimit;
        _tokensPerPeriod = tokensPerPeriod;
        _replenishmentPeriod = replenishmentPeriod;
    }

    public override TimeSpan? IdleDuration =>
        TimeSpan.FromMilliseconds(Environment.TickCount64 - Volatile.Read(ref _lastActivity));

    public override RateLimiterStatistics? GetStatistics() => null;

    protected override RateLimitLease AttemptAcquireCore(int permitCount)
    {
        // Synchronous acquire is not meaningful for a distributed limiter.
        // The ASP.NET Core middleware uses the async path; return success here
        // so the middleware falls through to AcquireAsync.
        return new RedisRateLimitLease(true);
    }

    protected override async ValueTask<RateLimitLease> AcquireAsyncCore(
        int permitCount, CancellationToken cancellationToken)
    {
        Volatile.Write(ref _lastActivity, Environment.TickCount64);

        try
        {
            var db = _redisClient.GetDatabase();
            var result = _type switch
            {
                RateLimiterType.FixedWindow => await EvalFixedWindowAsync(db),
                RateLimiterType.SlidingWindow => await EvalSlidingWindowAsync(db),
                RateLimiterType.TokenBucket => await EvalTokenBucketAsync(db),
                _ => throw new InvalidOperationException($"Unknown rate limiter type: {_type}")
            };

            // Positive = remaining permits/tokens. Negative = retry-after in seconds.
            if (result >= 0)
            {
                return new RedisRateLimitLease(true);
            }

            var retryAfter = TimeSpan.FromSeconds(Math.Max(1, Math.Abs(result)));
            return new RedisRateLimitLease(false, retryAfter);
        }
        catch
        {
            // Fail open – if Redis is unreachable, allow the request through.
            return new RedisRateLimitLease(true);
        }
    }

    private async Task<long> EvalFixedWindowAsync(IDatabase db)
    {
        var windowSeconds = (int)_window.TotalSeconds;
        var windowSlot = DateTimeOffset.UtcNow.ToUnixTimeSeconds() / windowSeconds;
        var key = $"rl:fw:{_partitionKey}:{windowSlot}";

        var result = await db.ScriptEvaluateAsync(
            FixedWindowScript,
            [(RedisKey)key],
            [(RedisValue)_permitLimit, (RedisValue)windowSeconds]);

        return long.Parse(result.ToString()!);
    }

    private async Task<long> EvalSlidingWindowAsync(IDatabase db)
    {
        var key = $"rl:sw:{_partitionKey}";
        var nowMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        var windowMs = (long)_window.TotalMilliseconds;
        var uniqueId = $"{nowMs}:{Guid.NewGuid():N}";

        var result = await db.ScriptEvaluateAsync(
            SlidingWindowScript,
            [(RedisKey)key],
            [(RedisValue)_permitLimit, (RedisValue)windowMs, (RedisValue)nowMs, (RedisValue)uniqueId]);

        return long.Parse(result.ToString()!);
    }

    private async Task<long> EvalTokenBucketAsync(IDatabase db)
    {
        var key = $"rl:tb:{_partitionKey}";
        var nowMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        var replenishMs = (long)_replenishmentPeriod.TotalMilliseconds;

        var result = await db.ScriptEvaluateAsync(
            TokenBucketScript,
            [(RedisKey)key],
            [(RedisValue)_tokenLimit, (RedisValue)_tokensPerPeriod, (RedisValue)replenishMs, (RedisValue)nowMs, (RedisValue)1]);

        return long.Parse(result.ToString()!);
    }

    protected override void Dispose(bool disposing) { }

    protected override ValueTask DisposeAsyncCore() => ValueTask.CompletedTask;
}
