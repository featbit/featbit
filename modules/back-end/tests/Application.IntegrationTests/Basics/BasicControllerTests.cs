using Api.Controllers;

namespace Application.IntegrationTests.Basics;

[Collection(nameof(TestApp))]
[UsesVerify]
public class BasicControllerTests
{
    private readonly TestApp _app;

    public BasicControllerTests(TestApp app)
    {
        _app = app;
    }

    [Fact]
    public async Task NeedAuthentication()
    {
        var response = await _app.GetAsync("api/v1/basic/authorized", authenticated: false);

        await Verify(response);
    }

    [Fact]
    public async Task AllowAnonymous()
    {
        var response = await _app.GetAsync("api/v1/basic/allow-anonymous", authenticated: false);

        await Verify(response);
    }

    [Fact]
    public async Task Authorized()
    {
        var response = await _app.GetAsync("api/v1/basic/authorized", authenticated: true);

        await Verify(response);
    }

    [Fact]
    public async Task ApiVersioning()
    {
        var v1 = await _app.GetAsync("api/v1/basic/string");
        var v2 = await _app.GetAsync("api/v2/basic/string");

        await Verify(new { v1, v2 });
    }

    [Fact]
    public async Task HandleException()
    {
        var response = await _app.GetAsync("api/v1/basic/exception");

        await Verify(response);
    }

    [Fact]
    public async Task ModelBinding()
    {
        var response = await _app.PostAsync("api/v2/basic/bar", new Bar("1", "bar"));

        await Verify(response);
    }
}