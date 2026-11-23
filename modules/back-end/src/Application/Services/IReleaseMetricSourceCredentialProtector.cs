using System.Text.Json;
using Domain.Environments;
using Domain.ReleaseMetricSourceConnections;

namespace Application.Services;

public interface IReleaseMetricSourceCredentialProtector
{
    string Protect(ResourceDescriptor scope, ReleaseMetricSourceConnection connection, JsonElement credential);
    JsonElement? Unprotect(ResourceDescriptor scope, ReleaseMetricSourceConnection connection);
}
