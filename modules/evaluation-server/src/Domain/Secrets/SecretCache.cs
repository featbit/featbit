using Domain.Shared;
using Microsoft.Extensions.Caching.Memory;

namespace Domain.Secrets;

// Shared Secret lookup cache for HTTP and streaming authentication.
public sealed class SecretCache(IStore store) : IDisposable
{
    // Maximum number of Secrets retained; each entry has size 1, not bytes.
    private const int MaxCacheEntries = 10_000;

    // Fixed lifetime after insertion. Revoked Secrets may remain accepted for this
    // duration plus an in-flight store read; cache hits do not extend expiration.
    private const int CacheTtlSeconds = 30;

    // Bound synchronization state while coalescing successful concurrent lookups.
    // More stripes reduce contention between unrelated Secrets at the cost of more locks.
    private const int LockStripeCount = 64;

    private readonly MemoryCache _cache = new(new MemoryCacheOptions { SizeLimit = MaxCacheEntries });
    private static readonly MemoryCacheEntryOptions CacheEntryOptions = new()
    {
        Size = 1,
        AbsoluteExpirationRelativeToNow = TimeSpan.FromSeconds(CacheTtlSeconds)
    };

    // Fixed stripes bound synchronization state even when callers send arbitrary keys.
    private readonly SemaphoreSlim[] _locks = Enumerable.Range(0, LockStripeCount)
        .Select(_ => new SemaphoreSlim(1, 1)).ToArray();

    public async Task<Secret?> GetAsync(string secretString)
    {
        if (_cache.TryGetValue(secretString, out Secret? cached))
        {
            return cached;
        }

        var gate = _locks[(uint)StringComparer.Ordinal.GetHashCode(secretString) % (uint)_locks.Length];
        await gate.WaitAsync();
        try
        {
            if (_cache.TryGetValue(secretString, out cached))
            {
                return cached;
            }

            var secret = await store.GetSecretAsync(secretString);
            if (secret is not null)
            {
                _cache.Set(secretString, secret, CacheEntryOptions);
            }

            return secret;
        }
        finally
        {
            gate.Release();
        }
    }

    public void Dispose()
    {
        _cache.Dispose();
        foreach (var gate in _locks)
        {
            gate.Dispose();
        }
    }
}
