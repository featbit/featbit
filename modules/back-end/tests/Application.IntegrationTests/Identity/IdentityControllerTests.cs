using Application.Identity;

namespace Application.IntegrationTests.Identity;

[Collection(nameof(TestApp))]
[UsesVerify]
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
            Email = TestData.Email,
            Password = TestData.RealPassword,
            WorkspaceKey = TestData.WorkspaceKey
        };
        var response = await _app.PostAsync("/api/v1/identity/login-by-email", request, false);

        await Verify(response);
    }
}