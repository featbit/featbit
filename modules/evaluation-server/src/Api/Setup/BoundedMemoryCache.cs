using Microsoft.Extensions.Caching.Memory;

namespace Api.Setup;

public class BoundedMemoryCache : IBoundedMemoryCache
{
    public MemoryCache Instance { get; } = new(
        new MemoryCacheOptions
        {
            SizeLimit = 1024 * 1024,
            ExpirationScanFrequency = TimeSpan.FromMinutes(1)
        });
}