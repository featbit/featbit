using System.Net;

namespace Application.IntegrationTests;

[Trait("Category", "Host")]
[Collection(nameof(TestApp))]
[Trait("Category", "Integration")]
public class SmokeTests
{
    private readonly TestApp _app;

    public SmokeTests(TestApp app)
    {
        _app = app;
    }

    [Fact]
    public async Task LivenessEndpoint_ServerStarted_Returns200Ok()
    {
        var client = _app.CreateClient();
        var response = await client.GetAsync("/health/liveness");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }
}
