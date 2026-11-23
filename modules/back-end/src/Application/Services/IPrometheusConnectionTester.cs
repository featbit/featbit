#nullable enable

using Application.ReleaseMetricSourceConnections;

namespace Application.Services;

public interface IPrometheusConnectionTester
{
    Task<ConnectionTestResult> TestAsync(Uri endpoint, string? username, string? password, string? bearerToken,
        CancellationToken cancellationToken);
}
