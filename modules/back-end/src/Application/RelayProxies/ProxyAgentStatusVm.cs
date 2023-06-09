namespace Microsoft.Extensions.DependencyInjection.RelayProxies;

public class ProxyAgentStatusVm
{
    public string Type { get; set; }
    public DateTime? LastSyncAt { get; set; }
}