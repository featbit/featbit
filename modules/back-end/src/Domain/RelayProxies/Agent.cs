namespace Domain.RelayProxies;

public class Agent
{
    public string Id { get; set; }

    public string Name { get; set; }

    public string Host { get; set; }

    public DateTime? SyncAt { get; set; }

    public bool IsValid()
    {
        return !string.IsNullOrWhiteSpace(Id) &&
               !string.IsNullOrWhiteSpace(Name) &&
               !string.IsNullOrWhiteSpace(Host);
    }
}