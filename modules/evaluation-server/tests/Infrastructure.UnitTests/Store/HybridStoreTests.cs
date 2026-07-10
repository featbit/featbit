using Domain.Shared;
using Infrastructure.Store;
using Microsoft.Extensions.Logging.Testing;
using Moq;

namespace Infrastructure.UnitTests.Store;

[Collection(StoreSingletonCollection.Name)]
public class HybridStoreTests : IDisposable
{
    public HybridStoreTests() => StoreAvailabilityListenerReset.Reset();
    public void Dispose() => StoreAvailabilityListenerReset.Reset();

    private static Mock<IDbStore> NewDbStore(string name)
    {
        var store = new Mock<IDbStore>();
        store.SetupGet(x => x.Name).Returns(name);
        return store;
    }

    private static IEnumerable<byte[]> Bytes(string s) => new[] { System.Text.Encoding.UTF8.GetBytes(s) };

    [Fact]
    public async Task Ctor_AvailableStoreInListenerMatchesOneOfRegisteredStores_SelectsThatStoreAsActive()
    {
        var redis = NewDbStore(Stores.Redis);
        var mongo = NewDbStore(Stores.MongoDb);
        StoreAvailabilityListener.Instance.SetAvailable(Stores.Redis);

        var store = new HybridStore(new[] { redis.Object, mongo.Object }, new FakeLogger<HybridStore>());

        redis.Setup(x => x.GetSecretAsync("s")).ReturnsAsync(new Secret(SecretTypes.Server, "p", Guid.NewGuid(), "e"));
        var secret = await store.GetSecretAsync("s");

        Assert.NotNull(secret);
        redis.Verify(x => x.GetSecretAsync("s"), Times.Once);
        mongo.Verify(x => x.GetSecretAsync(It.IsAny<string>()), Times.Never);
    }

    [Fact]
    public void Ctor_AvailableStoreInListenerNotRegistered_ThrowsArgumentException()
    {
        var redis = NewDbStore(Stores.Redis);
        StoreAvailabilityListener.Instance.SetAvailable("not-a-real-store");

        Assert.Throws<ArgumentException>(() =>
            new HybridStore(new[] { redis.Object }, new FakeLogger<HybridStore>()));
    }

    [Fact]
    public async Task GetFlagsAsync_DelegatesToActiveStore()
    {
        var redis = NewDbStore(Stores.Redis);
        var envId = Guid.NewGuid();
        redis.Setup(x => x.GetFlagsAsync(envId, 5L)).ReturnsAsync(Bytes("flag"));
        StoreAvailabilityListener.Instance.SetAvailable(Stores.Redis);

        var store = new HybridStore(new[] { redis.Object }, new FakeLogger<HybridStore>());

        var result = await store.GetFlagsAsync(envId, 5);

        Assert.Single(result);
        redis.Verify(x => x.GetFlagsAsync(envId, 5L), Times.Once);
    }

    [Fact]
    public async Task GetFlagsAsync_ById_DelegatesToActiveStore()
    {
        var redis = NewDbStore(Stores.Redis);
        var ids = new[] { "a", "b" };
        redis.Setup(x => x.GetFlagsAsync(ids)).ReturnsAsync(Bytes("flag"));
        StoreAvailabilityListener.Instance.SetAvailable(Stores.Redis);

        var store = new HybridStore(new[] { redis.Object }, new FakeLogger<HybridStore>());

        var result = await store.GetFlagsAsync(ids);

        Assert.Single(result);
        redis.Verify(x => x.GetFlagsAsync(ids), Times.Once);
    }

    [Fact]
    public async Task GetSegmentsAsync_DelegatesToActiveStore()
    {
        var redis = NewDbStore(Stores.Redis);
        var envId = Guid.NewGuid();
        redis.Setup(x => x.GetSegmentsAsync(envId, 0L)).ReturnsAsync(Bytes("seg"));
        StoreAvailabilityListener.Instance.SetAvailable(Stores.Redis);

        var store = new HybridStore(new[] { redis.Object }, new FakeLogger<HybridStore>());

        var result = await store.GetSegmentsAsync(envId, 0);

        Assert.Single(result);
        redis.Verify(x => x.GetSegmentsAsync(envId, 0L), Times.Once);
    }

    [Fact]
    public async Task GetSegmentAsync_DelegatesToActiveStore()
    {
        var redis = NewDbStore(Stores.Redis);
        redis.Setup(x => x.GetSegmentAsync("seg-1")).ReturnsAsync("payload"u8.ToArray());
        StoreAvailabilityListener.Instance.SetAvailable(Stores.Redis);

        var store = new HybridStore(new[] { redis.Object }, new FakeLogger<HybridStore>());

        var bytes = await store.GetSegmentAsync("seg-1");

        Assert.Equal("payload", System.Text.Encoding.UTF8.GetString(bytes));
        redis.Verify(x => x.GetSegmentAsync("seg-1"), Times.Once);
    }

    [Fact]
    public async Task ListenerSwitchesAvailableStore_HybridStoreUsesNewStoreAndLogsTransition()
    {
        var redis = NewDbStore(Stores.Redis);
        var mongo = NewDbStore(Stores.MongoDb);

        var envId = Guid.NewGuid();
        redis.Setup(x => x.GetFlagsAsync(envId, 0L)).ReturnsAsync(Bytes("from-redis"));
        mongo.Setup(x => x.GetFlagsAsync(envId, 0L)).ReturnsAsync(Bytes("from-mongo"));

        StoreAvailabilityListener.Instance.SetAvailable(Stores.Redis);
        var logger = new FakeLogger<HybridStore>();
        var store = new HybridStore(new[] { redis.Object, mongo.Object }, logger);

        StoreAvailabilityListener.Instance.SetAvailable(Stores.MongoDb);

        var result = await store.GetFlagsAsync(envId, 0);

        Assert.Equal("from-mongo", System.Text.Encoding.UTF8.GetString(result.Single()));
        var transitionLog = logger.Collector.GetSnapshot()
            .Single(r => r.Message.Contains("Store availability changed"));
        Assert.Contains(Stores.Redis, transitionLog.Message);
        Assert.Contains(Stores.MongoDb, transitionLog.Message);
    }

    [Fact]
    public async Task IsAvailableAsync_ListenerHasAnyAvailableStore_ReturnsTrue()
    {
        var redis = NewDbStore(Stores.Redis);
        StoreAvailabilityListener.Instance.SetAvailable(Stores.Redis);
        var store = new HybridStore(new[] { redis.Object }, new FakeLogger<HybridStore>());

        Assert.True(await store.IsAvailableAsync());
    }

    // NOTE: HybridStore.IsAvailableAsync() returns false when the listener is set to Stores.None,
    // but the constructor-time event handler unconditionally rejects unknown stores (including None),
    // so transitioning to None at runtime would throw. Exercising that branch directly is not
    // possible without fixing the production listener handler; left out by design.

    [Fact]
    public void Name_ReturnsHybrid()
    {
        var redis = NewDbStore(Stores.Redis);
        StoreAvailabilityListener.Instance.SetAvailable(Stores.Redis);
        var store = new HybridStore(new[] { redis.Object }, new FakeLogger<HybridStore>());

        Assert.Equal(Stores.Hybrid, store.Name);
    }
}
