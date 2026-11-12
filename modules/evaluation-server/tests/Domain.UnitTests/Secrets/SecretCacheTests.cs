using Domain.Secrets;
using Domain.Shared;
using Microsoft.Extensions.Internal;
using Moq;

namespace Domain.UnitTests.Secrets;

public class SecretCacheTests
{
    [Fact]
    public async Task ConcurrentMisses_ShareSuccessfulLookup_AndOtherSecretsInSameEnvironmentMiss()
    {
        var pending = new TaskCompletionSource<Secret?>(TaskCreationOptions.RunContinuationsAsynchronously);
        var otherSecret = GuidHelper.Encode(Guid.NewGuid()) + TestData.ServerSecretString[22..];
        var store = new Mock<IStore>(MockBehavior.Strict);
        store.Setup(x => x.GetSecretAsync(TestData.ServerSecretString)).Returns(pending.Task);
        store.Setup(x => x.GetSecretAsync(otherSecret)).ReturnsAsync((Secret?)null);
        using var cache = new SecretCache(store.Object);

        var requests = Enumerable.Range(0, 20)
            .Select(_ => cache.GetAsync(TestData.ServerSecretString)).ToArray();
        pending.SetResult(TestData.ServerSecret);
        var results = await Task.WhenAll(requests).WaitAsync(TimeSpan.FromSeconds(10));
        Assert.All(results, result => Assert.Same(TestData.ServerSecret, result));
        Assert.Same(TestData.ServerSecret, await cache.GetAsync(TestData.ServerSecretString));
        store.Verify(x => x.GetSecretAsync(TestData.ServerSecretString), Times.Once());

        Assert.Null(await cache.GetAsync(otherSecret));
        store.Verify(x => x.GetSecretAsync(otherSecret), Times.Once());
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task ConcurrentMisses_ShareMissingResultOrException_ThenRetry(bool throws)
    {
        var pending = new TaskCompletionSource<Secret?>(TaskCreationOptions.RunContinuationsAsynchronously);
        var store = new Mock<IStore>();
        store.Setup(x => x.GetSecretAsync(TestData.ServerSecretString)).Returns(pending.Task);
        using var cache = new SecretCache(store.Object);

        var requests = Enumerable.Range(0, 20)
            .Select(_ => cache.GetAsync(TestData.ServerSecretString)).ToArray();
        if (throws)
        {
            pending.SetException(new IOException("offline"));
            foreach (var request in requests)
                await Assert.ThrowsAsync<IOException>(() => request.WaitAsync(TimeSpan.FromSeconds(10)));
        }
        else
        {
            pending.SetResult(null);
            var results = await Task.WhenAll(requests).WaitAsync(TimeSpan.FromSeconds(10));
            Assert.All(results, result => Assert.Null(result));
        }
        store.Verify(x => x.GetSecretAsync(TestData.ServerSecretString), Times.Once());

        store.Setup(x => x.GetSecretAsync(TestData.ServerSecretString)).ReturnsAsync(TestData.ServerSecret);
        Assert.Same(TestData.ServerSecret, await cache.GetAsync(TestData.ServerSecretString));
        store.Verify(x => x.GetSecretAsync(TestData.ServerSecretString), Times.Exactly(2));
    }

    [Fact]
    public async Task SlowLookup_DoesNotBlockAnotherSecret()
    {
        var pending = new TaskCompletionSource<Secret?>(TaskCreationOptions.RunContinuationsAsynchronously);
        var firstKey = TestData.ServerSecretString;
        // Pick a key that would have shared a lock in the previous 64-stripe implementation.
        var oldStripe = (uint)StringComparer.Ordinal.GetHashCode(firstKey) % 64;
        var otherKey = Enumerable.Range(0, 10_000).Select(i => $"other-secret-{i}")
            .First(key => (uint)StringComparer.Ordinal.GetHashCode(key) % 64 == oldStripe);
        var store = new Mock<IStore>();
        store.Setup(x => x.GetSecretAsync(firstKey)).Returns(pending.Task);
        store.Setup(x => x.GetSecretAsync(otherKey)).ReturnsAsync(TestData.ClientSecret);
        using var cache = new SecretCache(store.Object);

        var slow = cache.GetAsync(firstKey);
        try
        {
            Assert.Same(TestData.ClientSecret,
                await cache.GetAsync(otherKey).WaitAsync(TimeSpan.FromSeconds(10)));
            Assert.False(slow.IsCompleted);
        }
        finally
        {
            pending.SetResult(TestData.ServerSecret);
            await slow.WaitAsync(TimeSpan.FromSeconds(10));
        }
    }

    [Fact]
    public async Task CacheHit_DoesNotExtendExpiration_AndExpiredSecretIsNotReused()
    {
        var now = DateTimeOffset.UnixEpoch;
        var clock = new Mock<ISystemClock>();
        clock.SetupGet(x => x.UtcNow).Returns(() => now);
        var store = new Mock<IStore>();
        store.SetupSequence(x => x.GetSecretAsync(TestData.ServerSecretString))
            .ReturnsAsync(TestData.ServerSecret).ReturnsAsync((Secret?)null);
        using var cache = new SecretCache(store.Object, clock.Object);

        Assert.Same(TestData.ServerSecret, await cache.GetAsync(TestData.ServerSecretString));
        now = now.AddSeconds(29);
        Assert.Same(TestData.ServerSecret, await cache.GetAsync(TestData.ServerSecretString));
        store.Verify(x => x.GetSecretAsync(TestData.ServerSecretString), Times.Once());

        now = now.AddSeconds(1);
        Assert.Null(await cache.GetAsync(TestData.ServerSecretString));
        store.Verify(x => x.GetSecretAsync(TestData.ServerSecretString), Times.Exactly(2));
    }
}
