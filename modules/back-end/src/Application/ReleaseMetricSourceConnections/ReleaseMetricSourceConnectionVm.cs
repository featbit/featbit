using System.Text.Json;
using Domain.ReleaseMetricSourceConnections;

namespace Application.ReleaseMetricSourceConnections;

public record ReleaseMetricSourceConnectionVm(
    Guid Id, Guid EnvironmentId, string Name, string ProviderType,
    JsonElement ProviderConfig, JsonElement Authentication,
    DateTime CreatedAt, DateTime UpdatedAt)
{
    public string SecretState { get; private init; } = "not_configured";

    internal static ReleaseMetricSourceConnectionVm From(ReleaseMetricSourceConnection connection) => new(
        connection.Id, connection.EnvId, connection.Name, connection.ProviderType,
        connection.ConnectionConfiguration.ProviderConfig, connection.ConnectionConfiguration.Authentication,
        connection.CreatedAt, connection.UpdatedAt)
    {
        SecretState = string.IsNullOrEmpty(connection.ProtectedCredential) ? "not_configured" : "configured"
    };
}
