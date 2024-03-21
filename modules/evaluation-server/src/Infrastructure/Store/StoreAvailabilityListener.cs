namespace Infrastructure.Store;

public class StoreAvailabilityListener
{
    private StoreAvailabilityListener()
    {
    }

    private static StoreAvailabilityListener? _instance;
    public static StoreAvailabilityListener Instance => _instance ??= new StoreAvailabilityListener();

    // assume redis is the default available store 
    public string AvailableStore = Stores.Redis;

    public event Action<string, string>? OnStoreAvailabilityChanged;

    public void SetAvailable(string currentAvailableStore)
    {
        var previousAvailableStore = AvailableStore;
        AvailableStore = currentAvailableStore;

        if (previousAvailableStore != currentAvailableStore)
        {
            OnStoreAvailabilityChanged?.Invoke(previousAvailableStore, currentAvailableStore);
        }
    }
}