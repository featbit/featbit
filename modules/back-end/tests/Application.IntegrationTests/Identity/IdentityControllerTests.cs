using System.Net;
using System.Net.Http.Json;
using System.Net.Mime;
using System.Text;
using System.Text.Json;
using Api.Controllers;
using Application.Identity;

namespace Application.IntegrationTests.Identity;

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

        var validationError =
            $"Validation failed: {Environment.NewLine} " +
            $"-- Identity: identity is required Severity: Error{Environment.NewLine} " +
            "-- Password: password is required Severity: Error";

        AssertHelpers.BadRequest(response, validationError);
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
        
        Assert.NotNull(response);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var content = await response.Content.ReadFromJsonAsync<ApiResponse>();
        Assert.NotNull(content);
        Assert.True(content.Success);
        Assert.Empty(content.Message);
        Assert.NotNull(content.Data);
    }

    private async Task<HttpResponseMessage?> DoRequestAsync(LoginByPassword request)
    {
        var client = _app.CreateClient();

        var body = JsonSerializer.Serialize(request);
        var content = new StringContent(body, Encoding.UTF8, MediaTypeNames.Application.Json);

        return await client.PostAsync("/api/v1/identity/login-by-password", content);
    }
}