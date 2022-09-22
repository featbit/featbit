namespace Application.IntegrationTests.Basics;

[UsesVerify]
public class BasicControllerTests : IClassFixture<TestApp>
{
    private readonly TestApp _app;

    public BasicControllerTests(TestApp app)
    {
        _app = app;
    }

    [Fact]
    public async Task ApiVersioning()
    {
        var client = _app.CreateClient();

        var v1 = await client.GetAsync("api/v1/basic/string");
        var v2 = await client.GetAsync("api/v2/basic/string");

        await Verify(new { v1, v2 });
    }

    [Fact]
    public async Task HandleException()
    {
        var client = _app.CreateClient();

        var response = await client.GetAsync("api/v1/basic/exception");

        await Verify(response);
    }
}