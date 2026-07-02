namespace Domain.RelayProxies;

public class Agent
{
    public string Id { get; set; }

    public string Name { get; set; }

    public string Host { get; set; }

    public DateTime? SyncAt { get; set; }

    public string Serves { get; set; }

    public long DataVersion { get; set; }

    // nullable for compatibility with older versions
    public DateTime? CreatedAt { get; set; }

    public bool IsValid()
    {
        return !string.IsNullOrWhiteSpace(Id) &&
               !string.IsNullOrWhiteSpace(Name) &&
               !string.IsNullOrWhiteSpace(Host);
    }

    public void Synced(string serves, long dataVersion)
    {
        Serves = serves;
        DataVersion = dataVersion;
        SyncAt = DateTime.UtcNow;
    }
}