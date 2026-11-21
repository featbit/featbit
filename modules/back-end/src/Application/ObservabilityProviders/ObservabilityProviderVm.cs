using System.Text.Json;
using Domain.ObservabilityProviders;

namespace Application.ObservabilityProviders;

public record ObservabilityProviderVm(
    Guid Id, Guid EnvironmentId, string Name, string ProviderType, int ProviderSchemaVersion,
    JsonElement ProviderConfig, JsonElement Authentication, long Revision, long Version,
    DateTime CreatedAt, DateTime UpdatedAt)
{
    internal static ObservabilityProviderVm From(ObservabilityProvider provider) => new(
        provider.Id, provider.EnvId, provider.Name, provider.ProviderType, provider.ProviderSchemaVersion,
        provider.ConnectionConfiguration.ProviderConfig, provider.ConnectionConfiguration.Authentication,
        provider.Revision, provider.Version, provider.CreatedAt, provider.UpdatedAt);
}
