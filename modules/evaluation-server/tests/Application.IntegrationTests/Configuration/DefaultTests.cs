using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.DependencyInjection;
using Streaming;
using Streaming.Connections;

namespace Application.IntegrationTests.Configuration;

[Trait("Category", "Host")]
[Collection(nameof(TestApp))]
[Trait("Category", "Integration")]
public class DefaultTests
{
    private readonly TestApp _app;

    public DefaultTests(TestApp app)
    {
        _app = app;
    }

    [Fact]
    public void EnvironmentName_NotConfigured_DefaultsToDevelopment()
    {
        var environment = _app.Services.GetRequiredService<IWebHostEnvironment>();

        // https://learn.microsoft.com/en-us/aspnet/core/test/integration-tests?view=aspnetcore-10.0&pivots=xunit#sut-environment
        // If the SUT's environment isn't set, the environment defaults to Development.
        Assert.Equal("Development", environment.EnvironmentName);
    }

    [Fact]
    public void StreamingOptions_NotConfigured_HasExpectedDefaults()
    {
        var options = _app.Services.GetRequiredService<StreamingOptions>();

        Assert.NotNull(options);

        Assert.Equal(ConnectionVersion.All, options.SupportedVersions);
        Assert.Equal(ConnectionType.All, options.SupportedTypes);
        Assert.Null(options.CustomRpService);
        Assert.True(options.TrackClientHostName);
        Assert.Equal(30, options.TokenExpirySeconds);
    }
}
