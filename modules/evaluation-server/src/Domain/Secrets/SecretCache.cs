using Domain.Shared;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Internal;

namespace Domain.Secrets;

// Shared Secret lookup cache for HTTP and streaming authentication.
public sealed class SecretCache(IStore store, ISystemClock? clock = null) : IDisposable
{
    // Maximum number of Secrets retained; each entry has size 1, not bytes.
    private const int MaxCacheEntries = 10_000;

    // Fixed lifetime after insertion. Revoked Secrets may remain accepted for this
    // duration plus an in-flight store read; cache hits do not extend expiration.
    private const int CacheTtlSeconds = 30;

    private readonly MemoryCache _cache = new(new MemoryCacheOptions
    {
        SizeLimit = MaxCacheEntries,
        Clock = clock
    });
    private static readonly MemoryCacheEntryOptions CacheEntryOptions = new()
    {
        Size = 1,
        AbsoluteExpirationRelativeToNow = TimeSpan.FromSeconds(CacheTtlSeconds)
    };

    private readonly Lock _lookupLock = new();
    private readonly Dictionary<string, TaskCompletionSource<Secret?>> _pendingLookups = new(StringComparer.Ordinal);

    public Task<Secret?> GetAsync(string secretString)
    {
        // check cache first
        if (_cache.TryGetValue(secretString, out Secret? cached))
        {
            return Task.FromResult(cached);
        }

        TaskCompletionSource<Secret?> lookupTcs;
        lock (_lookupLock)
        {
            // check again inside the lock to avoid a race condition
            // where another thread may have added the secret to the cache after the first check.
            if (_cache.TryGetValue(secretString, out cached))
            {
                return Task.FromResult(cached);
            }

            // if a lookup is already in progress, wait for it to complete instead of starting a new one.
            if (_pendingLookups.TryGetValue(secretString, out lookupTcs!))
            {
                return lookupTcs.Task;
            }

            // start a new lookup
            lookupTcs = new TaskCompletionSource<Secret?>(TaskCreationOptions.RunContinuationsAsynchronously);
            _pendingLookups.Add(secretString, lookupTcs);
        }

        // fire and forget the lookup
        _ = LookupAsync(secretString, lookupTcs);
        return lookupTcs.Task;
    }

    private async Task LookupAsync(string secretString, TaskCompletionSource<Secret?> lookup)
    {
        try
        {
            var secret = await store.GetSecretAsync(secretString);
            if (secret is not null)
            {
                _cache.Set(secretString, secret, CacheEntryOptions);
            }

            lock (_lookupLock)
            {
                _pendingLookups.Remove(secretString);
                lookup.SetResult(secret);
            }
        }
        catch (Exception ex)
        {
            lock (_lookupLock)
            {
                _pendingLookups.Remove(secretString);

                lookup.SetException(ex);
            }
        }
    }

    public void Dispose() => _cache.Dispose();
}
