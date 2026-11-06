using Microsoft.Extensions.Caching.Memory;

namespace Domain.EndUsers;

public sealed class EndUserDeduplicator : IDisposable
{
    // Maximum number of environment/user pairs retained; each entry has size 1, not bytes.
    private const int MaxCacheEntries = 1024 * 1024;

    // Suppress repeated user reports for this fixed window after the first report.
    // Cache hits do not extend the window.
    private const int DeduplicationWindowMinutes = 3;

    private readonly MemoryCache _cache = new(new MemoryCacheOptions
    {
        SizeLimit = MaxCacheEntries
    });

    private static readonly MemoryCacheEntryOptions CacheEntryOptions = new()
    {
        Size = 1,
        AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(DeduplicationWindowMinutes)
    };

    public bool TryMarkAsReported(Guid envId, string userKey)
    {
        var key = (envId, userKey);
        if (_cache.TryGetValue(key, out _))
        {
            return false;
        }

        _cache.Set(key, string.Empty, CacheEntryOptions);
        return true;
    }

    public void Dispose() => _cache.Dispose();
}
