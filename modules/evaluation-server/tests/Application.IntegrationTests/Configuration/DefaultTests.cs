using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.DependencyInjection;
using Streaming;
using Streaming.Connections;

namespace Application.IntegrationTests.Configuration;

[Collection(nameof(TestApp))]
public class DefaultTests
{
    private readonly TestApp _app;

    public DefaultTests(TestApp app)
    {
        _app = app;
    }
    
    [Fact]
    public void DefaultToDevelopmentEnvironment()
    {
        var environment = _app.Services.GetRequiredService<IWebHostEnvironment>();

        Assert.Equal("Development", environment.EnvironmentName);
    }

    [Fact]
    public void DefaultStreamingOptions()
    {
        var options = _app.Services.GetRequiredService<StreamingOptions>();

        Assert.NotNull(options);

        Assert.Equal(ConnectionVersion.All, options.SupportedVersions);
        Assert.Equal(ConnectionType.All, options.SupportedTypes);
        Assert.Null(options.CustomRpService);
        Assert.True(options.TrackClientHostName);
    }
}