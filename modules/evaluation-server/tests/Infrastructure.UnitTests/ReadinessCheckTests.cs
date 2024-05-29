using Infrastructure.Readiness;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using System.Threading.Tasks;
using Xunit;

namespace Infrastructure.UnitTests;

public class ReadinessCheckTests : ReadinessTest
{
    public ReadinessCheckTests() : base()
    { }

    [Theory]
    [InlineData("Service 1")]
    [InlineData("Service 2")]
    [InlineData("Service 3")]
    public async Task ItReturnsHealthyWhenTheTestReturnsTrue(string serviceName)
    {
        var healthyCheck = () => Task.FromResult(true);
        var readinessCheck = new ReadinessCheck(healthyCheck, serviceName);

        var actual = await readinessCheck.CheckHealthAsync(healthCheckContext);
        var expected = HealthCheckResult.Healthy($"{serviceName} is currently available.");

        Assert.Equal(expected.Description, actual.Description);
        Assert.Equal(expected.Status, actual.Status);
    }

    [Theory]
    [InlineData("Service 1")]
    [InlineData("Service 2")]
    [InlineData("Service 3")]
    public async Task ItReturnsUnhealthyWhenTheTestReturnsFalse(string serviceName)
    {
        var healthyCheck = () => Task.FromResult(false);
        var readinessCheck = new ReadinessCheck(healthyCheck, serviceName);

        var actual = await readinessCheck.CheckHealthAsync(healthCheckContext);
        var expected = HealthCheckResult.Unhealthy($"{serviceName} is currently unavailable.");

        Assert.Equal(expected.Status, actual.Status);
        Assert.Equal(expected.Description, actual.Description);
        Assert.Equal(expected.Exception, actual.Exception);
    }
}
