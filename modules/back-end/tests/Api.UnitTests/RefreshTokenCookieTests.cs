using Api.Setup;
using Domain.RefreshTokens;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;
using Microsoft.Net.Http.Headers;

namespace Api.UnitTests;

public class RefreshTokenCookieTests
{
    [Theory]
    [InlineData(null, "", "/api/v1/identity")]
    [InlineData("", "/featbit", "/featbit/api/v1/identity")]
    [InlineData(null, "/featbit/", "/featbit/api/v1/identity")]
    [InlineData("/deployment-prefix/manage/api/v1/identity", "", "/deployment-prefix/manage/api/v1/identity")]
    [InlineData("/external/api/v1/identity", "/internal", "/external/api/v1/identity")]
    public void IssueRotateAndDelete_UseTheSamePublicPath(string? configuredPath, string pathBase, string expectedPath)
    {
        using var host = CreateHost(configuredPath);
        var context = new DefaultHttpContext { RequestServices = host.Services };
        context.Request.PathBase = pathBase;

        context.Response.SetRefreshTokenCookie("initial-token");
        var initial = ReadCookie(context);
        Assert.Equal(expectedPath, initial.Path.Value);
        Assert.Equal("initial-token", initial.Value.Value);
        Assert.Equal(RefreshTokenConsts.CookieMaxAge, initial.MaxAge);
        Assert.True(initial.HttpOnly);
        Assert.False(initial.Secure);
        Assert.Equal(Microsoft.Net.Http.Headers.SameSiteMode.Lax, initial.SameSite);

        context.Response.Headers.Clear();
        context.Response.SetRefreshTokenCookie("rotated-token");
        var rotated = ReadCookie(context);
        Assert.Equal(expectedPath, rotated.Path.Value);
        Assert.Equal("rotated-token", rotated.Value.Value);

        context.Response.Headers.Clear();
        context.Response.DeleteRefreshTokenCookie();
        var deleted = ReadCookie(context);
        Assert.Equal(expectedPath, deleted.Path.Value);
        Assert.Equal(string.Empty, deleted.Value.Value);
        Assert.True(deleted.Expires < DateTimeOffset.UtcNow);
        Assert.Null(deleted.MaxAge);
    }

    [Fact]
    public void DifferentRequests_DoNotShareCookiePaths()
    {
        using var host = CreateHost(null);
        foreach (var prefix in new[] { "/first", "/second", "" })
        {
            var context = new DefaultHttpContext { RequestServices = host.Services };
            context.Request.PathBase = prefix;
            context.Response.SetRefreshTokenCookie("token");
            Assert.Equal(prefix + "/api/v1/identity", ReadCookie(context).Path.Value);
        }
    }

    [Theory]
    [InlineData("relative/path")]
    [InlineData("https://example.com/api/v1/identity")]
    [InlineData(" ")]
    public async Task InvalidConfiguration_FailsAtStartup(string path)
    {
        using var host = CreateHost(path);
        var exception = await Assert.ThrowsAsync<OptionsValidationException>(() => host.StartAsync());
        Assert.Contains("Authentication__RefreshTokenCookiePath", exception.Message);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("/deployment-prefix/manage/api/v1/identity")]
    [InlineData("/%E8%BA%AB%E4%BB%BD/api/v1/identity")]
    public async Task ValidConfiguration_StartsSuccessfully(string? path)
    {
        using var host = CreateHost(path);
        await host.StartAsync();
        await host.StopAsync();
    }

    private static IHost CreateHost(string? path)
    {
        var builder = Host.CreateApplicationBuilder();
        builder.Configuration.AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Authentication:RefreshTokenCookiePath"] = path
        });
        builder.Services.AddRefreshTokenCookies(builder.Configuration);
        return builder.Build();
    }

    private static SetCookieHeaderValue ReadCookie(DefaultHttpContext context)
    {
        var cookie = SetCookieHeaderValue.Parse(Assert.Single(context.Response.Headers.SetCookie)!);
        Assert.Equal(ApiConstants.RefreshTokenCookieName, cookie.Name.Value);
        return cookie;
    }
}
