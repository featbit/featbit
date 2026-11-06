using Domain.Secrets;
using Domain.Shared;
using Microsoft.Extensions.Caching.Memory;

namespace Api.Authentication;

// Only used by /track. Revoked secrets may remain accepted for up to five seconds
// after deletion from the selected store; hits never extend this window.
public sealed class TrackSecretCache(IStore store) : IDisposable
{
    private readonly MemoryCache _cache = new(new MemoryCacheOptions { SizeLimit = 10_000 });

    // Fixed stripes bound synchronization state even when callers send arbitrary keys.
    private readonly SemaphoreSlim[] _locks = Enumerable.Range(0, 64)
        .Select(_ => new SemaphoreSlim(1, 1)).ToArray();

    public async Task<Secret?> GetAsync(string secretString, Guid envId)
    {
        if (_cache.TryGetValue(secretString, out Secret? cached)) return cached;

        var gate = _locks[(uint)StringComparer.Ordinal.GetHashCode(secretString) % (uint)_locks.Length];
        await gate.WaitAsync();
        try
        {
            if (_cache.TryGetValue(secretString, out cached)) return cached;

            // Include lookup time in the TTL so a slow read cannot extend revocation delay.
            var expiresAt = DateTimeOffset.UtcNow.AddSeconds(5);
            var secret = await store.GetSecretAsync(secretString);
            if (secret is not null && secret.EnvId == envId &&
                secret.Type is SecretTypes.Client or SecretTypes.Server && expiresAt > DateTimeOffset.UtcNow)
            {
                _cache.Set(secretString, secret, new MemoryCacheEntryOptions
                {
                    Size = 1,
                    AbsoluteExpiration = expiresAt
                });
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
        foreach (var gate in _locks) gate.Dispose();
    }
}
