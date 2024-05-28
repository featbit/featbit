using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace Infrastructure.UnitTests;

public class ReadinessTest
{
    protected readonly HealthCheckContext healthCheckContext;

    public ReadinessTest() 
    {
        healthCheckContext = new();
    }
}
