using System.Reflection;
using System.Security.Claims;
using System.Text.Json;
using Api.Authentication;
using Api.Authorization;
using Api.Controllers;
using Api.Mcp;
using Api.Middlewares;
using Application.Bases;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc.Controllers;

namespace Api.UnitTests.Authentication;

public class TenantAccessValidationMiddlewareTests
{
    private static DefaultHttpContext Context()
    {
        var context = new DefaultHttpContext
        {
            User = new ClaimsPrincipal(new ClaimsIdentity([], Schemes.JwtBearer))
        };
        context.SetEndpoint(new Endpoint(null, new EndpointMetadataCollection(), "business"));
        return context;
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task ScopedRequest_UsesValidatorResult(bool valid)
    {
        var context = Context();
        context.Response.Body = new MemoryStream();
        var validator = new Mock<ITenantAccessValidator>(MockBehavior.Strict);
        validator.Setup(x => x.ValidateAsync(context)).ReturnsAsync(valid);
        var nextCalls = 0;
        var middleware = new TenantAccessValidationMiddleware(_ =>
        {
            nextCalls++;
            return Task.CompletedTask;
        });

        await middleware.InvokeAsync(context, validator.Object);

        validator.Verify(x => x.ValidateAsync(context), Times.Once);
        validator.VerifyNoOtherCalls();
        Assert.Equal(valid ? 1 : 0, nextCalls);
        Assert.Equal(valid ? StatusCodes.Status200OK : StatusCodes.Status403Forbidden, context.Response.StatusCode);
        if (!valid)
        {
            Assert.StartsWith("application/json", context.Response.ContentType);
            context.Response.Body.Position = 0;
            var body = await JsonSerializer.DeserializeAsync<ApiResponse<object>>(
                context.Response.Body, new JsonSerializerOptions(JsonSerializerDefaults.Web));
            Assert.NotNull(body);
            Assert.False(body.Success);
            Assert.Equal(ErrorCodes.Forbidden, Assert.Single(body.Errors));
        }
    }

    private static async Task AssertBypassed(HttpContext context)
    {
        var validator = new Mock<ITenantAccessValidator>(MockBehavior.Strict);
        var nextCalls = 0;
        var middleware = new TenantAccessValidationMiddleware(_ =>
        {
            nextCalls++;
            return Task.CompletedTask;
        });

        await middleware.InvokeAsync(context, validator.Object);

        Assert.Equal(1, nextCalls);
        Assert.Equal(StatusCodes.Status200OK, context.Response.StatusCode);
        validator.VerifyNoOtherCalls();
    }

    [Fact]
    public Task UnmatchedEndpoint_SkipsValidator()
    {
        var context = Context();
        context.SetEndpoint(null);
        return AssertBypassed(context);
    }

    [Theory]
    [InlineData(Schemes.OpenApi)]
    [InlineData(null)]
    public Task UnauthenticatedOrNonJwtRequest_SkipsValidator(string? scheme)
    {
        var context = Context();
        context.User = new ClaimsPrincipal(new ClaimsIdentity([], scheme));
        return AssertBypassed(context);
    }

    [Fact]
    public Task AnonymousEndpoint_SkipsValidator()
    {
        var context = Context();
        context.SetEndpoint(new Endpoint(null, new EndpointMetadataCollection(new AllowAnonymousAttribute()), "anonymous"));
        return AssertBypassed(context);
    }

    [Fact]
    public Task McpProtocolEndpoint_SkipsValidator()
    {
        var context = Context();
        context.Request.Path = "/mcp";
        return AssertBypassed(context);
    }

    [Fact]
    public Task McpAccessToken_SkipsValidator()
    {
        var context = Context();
        ((ClaimsIdentity)context.User.Identity!).AddClaim(new Claim(McpClaimTypes.TokenType, McpClaimTypes.McpTokenType));
        return AssertBypassed(context);
    }

    [Fact]
    public Task McpOAuthEndpoint_SkipsValidator()
    {
        var context = Context();
        var action = new ControllerActionDescriptor
        {
            ControllerTypeInfo = typeof(McpOAuthController).GetTypeInfo()
        };
        context.SetEndpoint(new Endpoint(null, new EndpointMetadataCollection(action), "mcp-oauth"));
        return AssertBypassed(context);
    }
}
