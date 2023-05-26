namespace Domain.RelayProxies;

public class RelayProxyAgent
{
    public string Id { get; set; }

    public string Name { get; set; }

    public string Key { get; set; }

    public string Host { get; set; }

    public DateTime? SyncAt { get; set; }
}