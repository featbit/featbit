using System.Net.Mime;
using System.Text;
using System.Text.Json;
using Application.Identity;

namespace Application.IntegrationTests.Identity;

[UsesVerify]
public class IdentityControllerTests : IClassFixture<IdentityApp>
{
    private readonly IdentityApp _app;

    public IdentityControllerTests(IdentityApp app)
    {
        _app = app;
    }

    [Fact]
    public async Task LoginByPassword_RequestValidation()
    {
        var request = new LoginByPassword();
        var response = await DoRequestAsync(request);

        await Verify(response);
    }

    [Fact]
    public async Task LoginByPassword_Success()
    {
        var request = new LoginByPassword
        {
            Identity = TestUser.Identity,
            Password = TestUser.RealPassword
        };
        var response = await DoRequestAsync(request);

        await Verify(response).ScrubLinesWithReplace(x => x.Split('.').Length == 3 ? "[Scrubbed JWT]" : x);
    }

    private async Task<HttpResponseMessage> DoRequestAsync(LoginByPassword request)
    {
        var client = _app.CreateClient();

        var body = JsonSerializer.Serialize(request);
        var content = new StringContent(body, Encoding.UTF8, MediaTypeNames.Application.Json);

        return await client.PostAsync("/api/v1/identity/login-by-password", content);
    }
}