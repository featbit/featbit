using Application.Identity;

namespace Application.IntegrationTests.Identity;

[Collection(nameof(TestApp))]
public class IdentityControllerTests
{
    private readonly TestApp _app;

    public IdentityControllerTests(TestApp app)
    {
        _app = app;
    }

    [Fact]
    public async Task LoginByEmail_RequestValidation()
    {
        var request = new LoginByEmail();
        var response = await _app.PostAsync("/api/v1/identity/login-by-email", request, false);

        await Verify(response);
    }

    [Fact]
    public async Task LoginByEmail_Success()
    {
        var request = new LoginByEmail
        {
            Email = TestUser.Email,
            Password = TestUser.RealPassword,
            WorkspaceKey = TestWorkspace.Key
        };
        var response = await _app.PostAsync("/api/v1/identity/login-by-email", request, false);


        var settings = new VerifySettings();
        settings.ScrubLinesWithReplace(
            x => x.StartsWith("eyJ") && x.Split('.').Length == 3 ? "[Scrubbed JWT]" : x
        );

        await Verify(response, settings: settings);
    }
}