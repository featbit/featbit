using System.Text.Json;

namespace Domain.ObservabilityProviders;

public record ProviderConnectionConfiguration(JsonElement ProviderConfig, JsonElement Authentication);

public class ObservabilityProvider : FullAuditedEntity
{
    public Guid EnvId { get; set; }
    public string Name { get; set; }
    public string ProviderType { get; set; }
    public int ProviderSchemaVersion { get; set; }
    public ProviderConnectionConfiguration ConnectionConfiguration { get; set; }
    public string ProtectedCredential { get; set; }
    public long Revision { get; set; } = 1;
    public long Version { get; set; } = 1;
    public bool IsDeleted { get; set; }
}
