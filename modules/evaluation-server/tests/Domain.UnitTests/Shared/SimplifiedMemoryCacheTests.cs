using Domain.Shared;

namespace Domain.UnitTests.Shared;

public class SimplifiedMemoryCacheTests
{
    [Fact]
    public void TestDefaultValues()
    {
        var cache = new SimplifiedMemoryCache();
        Assert.Equal(0, cache._currentSize);
        Assert.Equal(100_0000, cache._sizeLimit);
    }

    [Fact]
    public void TestExists()
    {
        var cache = new SimplifiedMemoryCache(100, TimeSpan.FromSeconds(30));
        cache.TryAdd("key", TimeSpan.FromMinutes(1));
        Assert.True(cache.Exists("key"));
    }

    [Fact]
    public void TestTryAdd()
    {
        var cache = new SimplifiedMemoryCache(100, TimeSpan.FromSeconds(30));
        Assert.True(cache.TryAdd("key", TimeSpan.FromMinutes(1)));
        Assert.True(cache.Exists("key"));
    }

    [Fact]
    public void TestTryAddExceedsCapacity()
    {
        var cache = new SimplifiedMemoryCache(1, TimeSpan.FromSeconds(30));
        var addKey1 = cache.TryAdd("key1", TimeSpan.FromMinutes(1));
        Assert.True(addKey1);
        Assert.Equal(1, cache._currentSize);

        var addKey2 = cache.TryAdd("key2", TimeSpan.FromMinutes(1));
        Assert.False(addKey2);
        Assert.Equal(1, cache._currentSize);
    }

    [Fact]
    public void TestTryAddSameKey()
    {
        var cache = new SimplifiedMemoryCache(100, TimeSpan.FromSeconds(30));
        var add = cache.TryAdd("key", TimeSpan.FromMinutes(1));
        Assert.True(add);

        var addAgain = cache.TryAdd("key", TimeSpan.FromMinutes(1));
        Assert.False(addAgain);
    }

    [Fact]
    public async Task TestEvictExpired()
    {
        var cache = new SimplifiedMemoryCache(100, TimeSpan.FromMilliseconds(100));
        var addResult = cache.TryAdd("key", TimeSpan.FromMilliseconds(50));
        Assert.True(addResult);
        Assert.Equal(1, cache._currentSize);

        await Task.Delay(200);
        Assert.False(cache.Exists("key"));
        Assert.Equal(0, cache._currentSize);
    }
}