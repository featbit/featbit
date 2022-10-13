namespace Domain.DataSync;

public class SyncData
{
    public DateTime Date { get; set; }

    public IEnumerable<EndUserSyncData> Users { get; set; } = Array.Empty<EndUserSyncData>();

    public IEnumerable<string> UserProperties { get; set; } = Array.Empty<string>();
}