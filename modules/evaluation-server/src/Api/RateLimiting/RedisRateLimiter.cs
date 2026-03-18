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
    private readonly ILogger _logger;
    private long _lastActivity = Environment.TickCount64;

    #region Lua scripts – executed atomically on Redis

    /// <summary>
    /// Fixed-window: increments a counter keyed by the current window slot.
    /// Uses Redis server time to derive the slot, avoiding client clock skew.
    /// Returns remaining permits (positive) or negative retry-after seconds.
    /// </summary>
    private const string FixedWindowScript = """
        local keyPrefix = ARGV[1]
        local limit = tonumber(ARGV[2])
        local window = tonumber(ARGV[3])
        local requested = tonumber(ARGV[4])
        -- Use Redis server time to avoid client clock skew across replicas
        local t = redis.call('TIME')
        local nowSec = tonumber(t[1])
        local slot = math.floor(nowSec / window)
        local key = keyPrefix .. ":" .. slot
        local current = redis.call('INCRBY', key, requested)
        if current == requested then
            redis.call('EXPIRE', key, window)
        end
        if current > limit then
            local ttl = redis.call('TTL', key)
            -- -2: key vanished between INCRBY and TTL -> treat as retry-after window
            if ttl == -2 then
                return -window
            end
            -- -1: no expiry set (e.g. after a PERSIST) -> self-heal and deny
            if ttl == -1 then
                redis.call('EXPIRE', key, window)
                ttl = window
            end
            return -ttl
        end
        return limit - current
        """;

    /// <summary>
    /// Sliding-window: uses a sorted set scored by timestamp.
    /// Each member is stored as "uniqueId:weight" so a single ZADD represents
    /// multiple permits without memory bloat. The weighted count is computed by
    /// iterating members and summing parsed weights — O(n) per call where n is
    /// the number of active members in the window, acceptable for typical rate limits.
    /// Returns remaining permits (positive) or negative retry-after seconds.
    /// </summary>
    private const string SlidingWindowScript = """
        local key = KEYS[1]
        local limit = tonumber(ARGV[1])
        local window = tonumber(ARGV[2])
        local id = ARGV[3]
        local requested = tonumber(ARGV[4])
        -- Use Redis server time to avoid client clock skew across replicas
        local t = redis.call('TIME')
        local now = (tonumber(t[1]) * 1000) + math.floor(tonumber(t[2]) / 1000)
        local clearBefore = now - window
        redis.call('ZREMRANGEBYSCORE', key, 0, clearBefore)
        -- Sum weights from all active members (each member is "id:weight")
        local members = redis.call('ZRANGE', key, 0, -1)
        local weightedCount = 0
        for i = 1, #members do
            local w = tonumber(string.match(members[i], ':(%d+)$')) or 1
            weightedCount = weightedCount + w
        end
        if weightedCount + requested > limit then
            local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
            if #oldest > 0 then
                local retryAfterMs = tonumber(oldest[2]) + window - now
                retryAfterMs = math.max(1000, retryAfterMs)
                return -math.ceil(retryAfterMs / 1000)
            end
            return -math.ceil(window / 1000)
        end
        redis.call('ZADD', key, now, id .. ":" .. requested)
        redis.call('EXPIRE', key, math.ceil(window / 1000) + 1)
        return limit - weightedCount - requested
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
        local requested = tonumber(ARGV[4])
        -- Use Redis server time to avoid client clock skew across replicas
        local t = redis.call('TIME')
        local now = (tonumber(t[1]) * 1000) + math.floor(tonumber(t[2]) / 1000)
        -- Load state
        local bucket = redis.call('HMGET', key, 'tokens', 'last_refill')
        local tokens = tonumber(bucket[1])
        local lastRefill = tonumber(bucket[2])
        -- Initialize if either field is missing or corrupt
        if tokens == nil or lastRefill == nil then
            tokens = tokenLimit
            lastRefill = now
        end
        -- Guard against bad configuration (prevents divide-by-zero)
        if tokensPerPeriod <= 0 or replenishMs <= 0 then
            if tokens >= requested then
                tokens = tokens - requested
                redis.call('HMSET', key, 'tokens', tokens, 'last_refill', lastRefill)
                redis.call('EXPIRE', key, 3600)
                return tokens
            end
            redis.call('HMSET', key, 'tokens', tokens, 'last_refill', lastRefill)
            redis.call('EXPIRE', key, 3600)
            return -1
        end
        -- Refill based on elapsed time
        local elapsed = now - lastRefill
        if elapsed > 0 then
            local newTokens = math.floor(elapsed * tokensPerPeriod / replenishMs)
            if newTokens > 0 then
                tokens = math.min(tokenLimit, tokens + newTokens)
                lastRefill = lastRefill + math.floor(newTokens * replenishMs / tokensPerPeriod)
            end
        end
        -- TTL: time to go from empty to full, plus padding
        local ttlSeconds = math.ceil((replenishMs * tokenLimit / tokensPerPeriod) / 1000) + 60
        if tokens >= requested then
            tokens = tokens - requested
            redis.call('HMSET', key, 'tokens', tokens, 'last_refill', lastRefill)
            redis.call('EXPIRE', key, ttlSeconds)
            return tokens
        else
            redis.call('HMSET', key, 'tokens', tokens, 'last_refill', lastRefill)
            redis.call('EXPIRE', key, ttlSeconds)
            local deficit = requested - tokens
            local retryMs = math.ceil(deficit * replenishMs / tokensPerPeriod)
            return -math.max(1, math.ceil(retryMs / 1000))
        end
        """;

    #endregion

    public RedisRateLimiter(IRedisClient redisClient, string partitionKey, EffectiveOptions options, ILogger logger)
    {
        ArgumentNullException.ThrowIfNull(redisClient);
        ArgumentNullException.ThrowIfNull(logger);

        _redisClient = redisClient;
        _partitionKey = partitionKey;
        _type = options.Type;
        _permitLimit = options.PermitLimit;
        _window = TimeSpan.FromSeconds(options.WindowSeconds);
        _tokenLimit = options.TokenLimit;
        _tokensPerPeriod = options.TokensPerPeriod;
        _replenishmentPeriod = TimeSpan.FromSeconds(options.ReplenishmentPeriodSeconds);
        _logger = logger;
    }

    public override TimeSpan? IdleDuration =>
        TimeSpan.FromMilliseconds(Environment.TickCount64 - Volatile.Read(ref _lastActivity));

    public override RateLimiterStatistics? GetStatistics() => null;

    protected override RateLimitLease AttemptAcquireCore(int permitCount)
    {
        // Distributed limiter requires a network call to Redis, which is inherently async.
        // Return a failed lease so the ASP.NET Core middleware falls through to AcquireAsync.
        return new RedisRateLimitLease(false);
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
                RateLimiterType.FixedWindow => await EvalFixedWindowAsync(db, permitCount),
                RateLimiterType.SlidingWindow => await EvalSlidingWindowAsync(db, permitCount),
                RateLimiterType.TokenBucket => await EvalTokenBucketAsync(db, permitCount),
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
        catch (RedisException ex)
        {
            // Fail open – if Redis is unreachable, allow the request through.
            _logger.LogWarning(ex, "Redis rate-limit evaluation failed for {PartitionKey}; failing open", _partitionKey);
            return new RedisRateLimitLease(true);
        }
        catch (RedisTimeoutException ex)
        {
            // Fail open – if Redis times out, allow the request through.
            _logger.LogWarning(ex, "Redis rate-limit evaluation timed out for {PartitionKey}; failing open", _partitionKey);
            return new RedisRateLimitLease(true);
        }
    }

    private async Task<long> EvalFixedWindowAsync(IDatabase db, int permitCount)
    {
        var windowSeconds = (int)_window.TotalSeconds;
        var keyPrefix = $"rl:fw:{_partitionKey}";

        // Key construction and slot derivation happen inside the Lua script
        // using Redis server time to avoid cross-node clock skew.
        var result = await db.ScriptEvaluateAsync(
            FixedWindowScript,
            keys: [],
            [(RedisValue)keyPrefix, (RedisValue)_permitLimit, (RedisValue)windowSeconds, (RedisValue)permitCount]);

        return long.Parse(result.ToString()!);
    }

    private async Task<long> EvalSlidingWindowAsync(IDatabase db, int permitCount)
    {
        var key = $"rl:sw:{_partitionKey}";
        var windowMs = (long)_window.TotalMilliseconds;
        var uniqueId = Guid.NewGuid().ToString("N");

        var result = await db.ScriptEvaluateAsync(
            SlidingWindowScript,
            [(RedisKey)key],
            [(RedisValue)_permitLimit, (RedisValue)windowMs, (RedisValue)uniqueId, (RedisValue)permitCount]);

        return long.Parse(result.ToString()!);
    }

    private async Task<long> EvalTokenBucketAsync(IDatabase db, int permitCount)
    {
        var key = $"rl:tb:{_partitionKey}";
        var replenishMs = (long)_replenishmentPeriod.TotalMilliseconds;

        var result = await db.ScriptEvaluateAsync(
            TokenBucketScript,
            [(RedisKey)key],
            [(RedisValue)_tokenLimit, (RedisValue)_tokensPerPeriod, (RedisValue)replenishMs, (RedisValue)permitCount]);

        return long.Parse(result.ToString()!);
    }

    protected override void Dispose(bool disposing) { }

    protected override ValueTask DisposeAsyncCore() => ValueTask.CompletedTask;
}
