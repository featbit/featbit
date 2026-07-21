using Application;
using Application.ControlPlane;
using Microsoft.Extensions.Configuration;

namespace Api.UnitTests.Application.Configuration;

public class ConsistencyModeTests
{
    private static IConfiguration CreateConfiguration(string? consistencyMode)
    {
        var data = new Dictionary<string, string?>();
        if (consistencyMode != null)
        {
            data["ControlPlane:ConsistencyMode"] = consistencyMode;
        }

        return new ConfigurationBuilder()
            .AddInMemoryCollection(data)
            .Build();
    }

    [Fact]
    public void GetConsistencyMode_WhenUnset_ReturnsBestEffort()
    {
        var configuration = CreateConfiguration(null);

        var result = configuration.GetConsistencyMode();

        Assert.Equal(ConsistencyMode.BestEffort, result);
    }

    [Fact]
    public void GetConsistencyMode_WhenGatedCommit_ReturnsGatedCommit()
    {
        var configuration = CreateConfiguration("GatedCommit");

        var result = configuration.GetConsistencyMode();

        Assert.Equal(ConsistencyMode.GatedCommit, result);
    }

    [Fact]
    public void GetConsistencyMode_WhenGarbage_ReturnsBestEffort()
    {
        var configuration = CreateConfiguration("not-a-real-mode");

        var result = configuration.GetConsistencyMode();

        Assert.Equal(ConsistencyMode.BestEffort, result);
    }
}
