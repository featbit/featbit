using System.Text.Json;
using Domain.ReleaseMetricSourceConnections;

namespace Application.ReleaseMetricSourceConnections;

public record ReleaseMetricSourceConnectionVm(
    Guid Id, Guid EnvironmentId, string Name, string ProviderType,
    JsonElement ProviderConfig, JsonElement Authentication,
    DateTime CreatedAt, DateTime UpdatedAt)
{
    internal static ReleaseMetricSourceConnectionVm From(ReleaseMetricSourceConnection connection) => new(
        connection.Id, connection.EnvId, connection.Name, connection.ProviderType,
        connection.ConnectionConfiguration.ProviderConfig, connection.ConnectionConfiguration.Authentication,
        connection.CreatedAt, connection.UpdatedAt);
}
