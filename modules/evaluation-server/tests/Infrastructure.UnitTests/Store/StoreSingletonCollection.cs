namespace Infrastructure.UnitTests.Store;

// Shared collection: prevents parallel execution of test classes that mutate
// the StoreAvailabilityListener singleton (StoreAvailabilityListenerTests,
// HybridStoreTests, StoreAvailableSentinelTests). Classes opt-in with
// [Collection(StoreSingletonCollection.Name)].
[CollectionDefinition(Name, DisableParallelization = true)]
public class StoreSingletonCollection
{
    public const string Name = "StoreSingleton";
}

/// <summary>
/// HybridStore and other listener consumers permanently subscribe to
/// <see cref="StoreAvailabilityListener.Instance"/> (designed for singletons in production).
/// In tests, those subscriptions leak across constructions: a later <c>SetAvailable</c>
/// call fires every prior handler, some of which throw because their store map doesn't
/// contain the new value. This helper clears the singleton's event subscribers and
/// resets <c>AvailableStore</c> to empty between tests.
/// </summary>
internal static class StoreAvailabilityListenerReset
{
    public static void Reset()
    {
        var listener = Infrastructure.Store.StoreAvailabilityListener.Instance;
        var type = listener.GetType();

        var eventField = type.GetField(
            nameof(Infrastructure.Store.StoreAvailabilityListener.OnStoreAvailabilityChanged),
            System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.NonPublic);
        eventField?.SetValue(listener, null);

        var availableProp = type.GetProperty(
            nameof(Infrastructure.Store.StoreAvailabilityListener.AvailableStore));
        availableProp?.SetValue(listener, string.Empty);
    }
}

