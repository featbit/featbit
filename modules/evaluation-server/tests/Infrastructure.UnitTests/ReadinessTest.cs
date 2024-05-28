using Microsoft.Extensions.Diagnostics.HealthChecks;
using System;
using System.Threading.Tasks;

namespace Infrastructure.UnitTests;

public class ReadinessTest
{
    protected readonly HealthCheckContext healthCheckContext;

    public ReadinessTest() 
    {
        healthCheckContext = new();
    }

    public virtual Task ItReturnsTheExpectedStatus(bool isServiceAvailable, HealthCheckResult expecetedCheckResult)
    {
        throw new NotImplementedException();
    }
}
