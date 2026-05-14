using System.Threading.RateLimiting;

namespace Api.RateLimiting;

/// <summary>
/// A simple <see cref="RateLimitLease"/> that carries an acquired/rejected result
/// and an optional <c>Retry-After</c> duration for the Redis-backed rate limiter.
/// </summary>
public sealed class RedisRateLimitLease : RateLimitLease
{
    private static readonly string[] s_metadataNames = [MetadataName.RetryAfter.Name];

    public override bool IsAcquired { get; }

    public override IEnumerable<string> MetadataNames => _retryAfter.HasValue ? s_metadataNames : [];

    private readonly TimeSpan? _retryAfter;

    public RedisRateLimitLease(bool isAcquired, TimeSpan? retryAfter = null)
    {
        IsAcquired = isAcquired;
        _retryAfter = retryAfter;
    }

    public override bool TryGetMetadata(string metadataName, out object? metadata)
    {
        if (metadataName == MetadataName.RetryAfter.Name && _retryAfter.HasValue)
        {
            metadata = _retryAfter.Value;
            return true;
        }

        metadata = null;
        return false;
    }

    public override IEnumerable<KeyValuePair<string, object?>> GetAllMetadata()
    {
        if (_retryAfter.HasValue)
        {
            yield return new KeyValuePair<string, object?>(MetadataName.RetryAfter.Name, _retryAfter.Value);
        }
    }
}