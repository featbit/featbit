using System.Collections.Concurrent;

namespace Domain.Shared;

// credits to:
// https://github.com/jitbit/FastCache/blob/main/FastCache/FastCache.cs
// https://github.com/dotnet/runtime/blob/main/src/libraries/Microsoft.Extensions.Caching.Memory/src/MemoryCache.cs

/// <summary>
/// Simplified MemoryCache alternative, basically a concurrent dictionary with expiration
/// </summary>
public sealed class SimplifiedMemoryCache
{
    private readonly ConcurrentDictionary<string, long> _concurrentDictionary = new();
    private readonly Timer _evictTimer;

    private long _currentSize;
    private readonly long _sizeLimit;

    public SimplifiedMemoryCache(long? sizeLimit = null, TimeSpan? evictInterval = null)
    {
        var interval = evictInterval ?? TimeSpan.FromSeconds(30);
        _sizeLimit = sizeLimit ?? 100 * 0000;

        _evictTimer = new Timer(
            _ => EvictExpiredInternal(),
            null,
            interval,
            interval
        );
    }

    public bool Exists(string key) => _concurrentDictionary.ContainsKey(key);

    public bool TryAdd(string key, TimeSpan ttl)
    {
        var exceedsCapacity = UpdateCacheSizeExceedsCapacity();
        if (exceedsCapacity)
        {
            return false;
        }

        return _concurrentDictionary.TryAdd(key, Environment.TickCount64 + (long)ttl.TotalMilliseconds);
    }

    /// <summary>
    /// Returns true if increasing the cache size by one would cause it to exceed any size limit on the cache, otherwise, returns false.
    /// </summary>
    private bool UpdateCacheSizeExceedsCapacity()
    {
        var sizeRead = Interlocked.Read(ref _currentSize);
        for (var i = 0; i < 100; i++)
        {
            var newSize = sizeRead + 1;
            if ((ulong)newSize > (ulong)_sizeLimit)
            {
                // Overflow occurred, return true without updating the cache size
                return true;
            }

            var original = Interlocked.CompareExchange(ref _currentSize, newSize, sizeRead);
            if (sizeRead == original)
            {
                return false;
            }

            sizeRead = original;
        }

        return true;
    }

    private void EvictExpiredInternal()
    {
        // Eviction already started by another thread? forget it, lets move on
        // use the timer-object for our lock, it's local, private and instance-type, so its ok
        if (!Monitor.TryEnter(_evictTimer))
        {
            return;
        }

        try
        {
            var current = Environment.TickCount64;
            foreach (var kvPair in _concurrentDictionary)
            {
                if (current > kvPair.Value)
                {
                    _concurrentDictionary.TryRemove(kvPair);
                    Interlocked.Add(ref _currentSize, -1);
                }
            }
        }
        finally
        {
            Monitor.Exit(_evictTimer);
        }
    }
}