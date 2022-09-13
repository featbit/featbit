using System.Net;

namespace Application.IntegrationTests;

public class SmokeTests : IClassFixture<TestApp>
{
    private readonly TestApp _app;

    public SmokeTests(TestApp app)
    {
        _app = app;
    }

    [Fact]
    public async Task Start()
    {
        var client = _app.CreateClient();
        var response = await client.GetAsync("/WeatherForecast");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }
}