using Microsoft.Extensions.Caching.Memory;

namespace Api.Setup
{
    public interface IBoundedMemoryCache
    {
        MemoryCache Instance { get; }
    }
}