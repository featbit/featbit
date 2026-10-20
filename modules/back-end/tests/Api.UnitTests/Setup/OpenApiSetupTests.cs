using System.Reflection;
using Api.Controllers;
using Api.Setup.OpenApi;
using Asp.Versioning;

namespace Api.UnitTests.Setup;

public class OpenApiSetupTests
{
    [Fact]
    public void SupportedApiVersions_ControllerVersionsDeclared_MatchesControllers()
    {
        // Arrange
        var declared = typeof(BasicController).Assembly
            .GetTypes()
            .SelectMany(t => t.GetCustomAttributes<ApiVersionAttribute>())
            .SelectMany(a => a.Versions)
            .Distinct()
            .OrderBy(v => v)
            .ToList();

        // Act
        var supported = OpenApiSetup.SupportedApiVersions.OrderBy(v => v).ToList();

        // Assert
        Assert.Equal(declared, supported);
    }
}
