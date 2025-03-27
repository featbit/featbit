namespace Infrastructure.Store;

public class StoreAvailabilityListener
{
    private StoreAvailabilityListener()
    {
    }

    private static StoreAvailabilityListener? _instance;
    public static StoreAvailabilityListener Instance => _instance ??= new StoreAvailabilityListener();

    public string AvailableStore { get; private set; } = string.Empty;

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