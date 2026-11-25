#nullable enable

using System.Text.Json;

namespace Domain.ReleaseMetricSourceConnections;

public record ReleaseMetricSourceConnectionSettings(JsonElement ProviderConfig, JsonElement Authentication);

public class ReleaseMetricSourceConnection : AuditedEntity
{
    public Guid EnvId { get; set; }
    public string Name { get; set; }
    public string ProviderType { get; set; }
    public ReleaseMetricSourceConnectionSettings ConnectionConfiguration { get; set; }
    public string? ProtectedCredential { get; set; }
    public bool IsDeleted { get; set; }

    public ReleaseMetricSourceConnection(Guid envId, string name, string providerType,
        ReleaseMetricSourceConnectionSettings connectionConfiguration)
    {
        Id = Guid.NewGuid();
        EnvId = envId;
        Name = name;
        ProviderType = providerType;
        ConnectionConfiguration = connectionConfiguration;
    }

    public void Update(string name, string providerType, ReleaseMetricSourceConnectionSettings connectionConfiguration)
    {
        Name = name;
        ProviderType = providerType;
        ConnectionConfiguration = connectionConfiguration;
        UpdatedAt = DateTime.UtcNow;
    }
}
