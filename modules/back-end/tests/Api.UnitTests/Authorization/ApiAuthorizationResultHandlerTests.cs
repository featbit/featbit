using System.Text.Json;
using Api.Authorization;
using Api.Controllers;
using Application.Bases;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Authorization.Policy;
using Microsoft.AspNetCore.Http;
using Microsoft.Net.Http.Headers;

namespace Api.UnitTests.Authorization;

public class ApiAuthorizationResultHandlerTests
{
    private static (DefaultHttpContext ctx, MemoryStream body) BuildContext()
    {
        var ctx = new DefaultHttpContext();
        var body = new MemoryStream();
        ctx.Response.Body = body;
        return (ctx, body);
    }

    private static async Task<ApiResponse<object>?> ReadBodyAsync(MemoryStream body)
    {
        body.Position = 0;
        return await JsonSerializer.DeserializeAsync<ApiResponse<object>>(
            body,
            new JsonSerializerOptions(JsonSerializerDefaults.Web));
    }

    [Fact]
    public async Task HandleAsync_Challenged_Writes401WithWwwAuthenticateAndApiError()
    {
        var (ctx, body) = BuildContext();
        var policy = new AuthorizationPolicyBuilder().RequireAssertion(_ => true).Build();
        var result = PolicyAuthorizationResult.Challenge();
        var nextCalled = false;
        RequestDelegate next = _ => { nextCalled = true; return Task.CompletedTask; };

        await new ApiAuthorizationResultHandler().HandleAsync(next, ctx, policy, result);

        Assert.False(nextCalled);
        Assert.Equal(StatusCodes.Status401Unauthorized, ctx.Response.StatusCode);
        Assert.Equal(JwtBearerDefaults.AuthenticationScheme, ctx.Response.Headers[HeaderNames.WWWAuthenticate]);

        var apiResponse = await ReadBodyAsync(body);
        Assert.NotNull(apiResponse);
        Assert.False(apiResponse!.Success);
        Assert.Contains(ErrorCodes.Unauthorized, apiResponse.Errors);
    }

    [Fact]
    public async Task HandleAsync_Forbidden_Writes403WithApiError()
    {
        var (ctx, body) = BuildContext();
        var policy = new AuthorizationPolicyBuilder().RequireAssertion(_ => true).Build();
        var result = PolicyAuthorizationResult.Forbid();
        var nextCalled = false;
        RequestDelegate next = _ => { nextCalled = true; return Task.CompletedTask; };

        await new ApiAuthorizationResultHandler().HandleAsync(next, ctx, policy, result);

        Assert.False(nextCalled);
        Assert.Equal(StatusCodes.Status403Forbidden, ctx.Response.StatusCode);

        var apiResponse = await ReadBodyAsync(body);
        Assert.NotNull(apiResponse);
        Assert.False(apiResponse!.Success);
        Assert.Contains(ErrorCodes.Forbidden, apiResponse.Errors);
    }

    [Fact]
    public async Task HandleAsync_Success_CallsNextWithoutWritingError()
    {
        var (ctx, body) = BuildContext();
        var policy = new AuthorizationPolicyBuilder().RequireAssertion(_ => true).Build();
        var result = PolicyAuthorizationResult.Success();
        var nextCalled = false;
        RequestDelegate next = _ => { nextCalled = true; return Task.CompletedTask; };

        await new ApiAuthorizationResultHandler().HandleAsync(next, ctx, policy, result);

        Assert.True(nextCalled);
        Assert.Equal(0, body.Length);
    }
}
