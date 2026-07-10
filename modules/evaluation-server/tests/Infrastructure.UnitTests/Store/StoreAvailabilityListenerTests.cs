using Infrastructure.Store;

namespace Infrastructure.UnitTests.Store;

// NOTE: StoreAvailabilityListener is a singleton with mutable state.
// Tests in this class share state with other suites that touch the listener (e.g. HybridStoreTests,
// StoreAvailableSentinelTests). Each test re-asserts the value it expects to leave behind.
[Collection(StoreSingletonCollection.Name)]
public class StoreAvailabilityListenerTests : IDisposable
{
    public StoreAvailabilityListenerTests() => StoreAvailabilityListenerReset.Reset();
    public void Dispose() => StoreAvailabilityListenerReset.Reset();

    [Fact]
    public void Instance_SameInstanceReturnedAcrossCalls()
    {
        Assert.Same(StoreAvailabilityListener.Instance, StoreAvailabilityListener.Instance);
    }

    [Fact]
    public void SetAvailable_NewValue_RaisesOnStoreAvailabilityChangedWithPreviousAndCurrent()
    {
        var listener = StoreAvailabilityListener.Instance;
        listener.SetAvailable("listener-prep");

        var observed = new List<(string prev, string current)>();
        Action<string, string> handler = (p, c) => observed.Add((p, c));
        listener.OnStoreAvailabilityChanged += handler;

        try
        {
            listener.SetAvailable("listener-next");
        }
        finally
        {
            listener.OnStoreAvailabilityChanged -= handler;
        }

        Assert.Single(observed);
        Assert.Equal(("listener-prep", "listener-next"), observed[0]);
        Assert.Equal("listener-next", listener.AvailableStore);
    }

    [Fact]
    public void SetAvailable_SameValue_DoesNotRaiseEvent()
    {
        var listener = StoreAvailabilityListener.Instance;
        listener.SetAvailable("listener-stable");

        var fired = 0;
        Action<string, string> handler = (_, _) => fired++;
        listener.OnStoreAvailabilityChanged += handler;

        try
        {
            listener.SetAvailable("listener-stable");
        }
        finally
        {
            listener.OnStoreAvailabilityChanged -= handler;
        }

        Assert.Equal(0, fired);
    }
}
