using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace Infrastructure.Readiness;

public class ReadinessCheck : IHealthCheck
{
    private readonly Func<Task<bool>> _healthyCheck;
    private readonly string _serviceName;

    public ReadinessCheck(Func<Task<bool>> healthyCheck, string serviceName)
    {
        _healthyCheck = healthyCheck;
        _serviceName = serviceName;
    }

    public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken cancellationToken = default)
    {
        var isHealthy = await _healthyCheck();
        var availability = isHealthy ? "available" : "unavailable";
        var message = $"{_serviceName} is currently {availability}.";

        return isHealthy ? HealthCheckResult.Healthy(message) : HealthCheckResult.Unhealthy(message);
    }
}
