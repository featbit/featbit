using Domain.Shared;

namespace Domain.UnitTests.Shared;

public class SimplifiedMemoryCacheTests
{
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

        var addKey2 = cache.TryAdd("key2", TimeSpan.FromMinutes(1));
        Assert.False(addKey2);
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

        await Task.Delay(200);
        Assert.False(cache.Exists("key"));
    }
}