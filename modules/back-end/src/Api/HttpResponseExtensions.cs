using Api.Authentication;
using Domain.RefreshTokens;
using Microsoft.Extensions.Options;

namespace Api;

public static class HttpResponseExtensions
{
    private static CookieOptions CreateCookieOptions(HttpResponse response)
    {
        var configuredPath = response.HttpContext.RequestServices
            .GetRequiredService<IOptions<RefreshTokenCookieOptions>>().Value.RefreshTokenCookiePath;

        return new CookieOptions
        {
            // prevent client-side scripts from accessing the cookie, which can help mitigate XSS attacks
            HttpOnly = true,

            // we'd better set to true to ensure the cookie is only sent over HTTPS and this should be an option that
            // can be configured through environment variables, for now we set it to false to make it works in any environment
            Secure = false,

            // we need to allow cookies are sent on cross-origin XHR/fetch with withCredentials
            SameSite = SameSiteMode.Lax,

            Path = string.IsNullOrEmpty(configuredPath)
                ? response.HttpContext.Request.PathBase.Add(new PathString(ApiConstants.RefreshTokenCookiePath)).Value
                : configuredPath
        };
    }

    public static void SetRefreshTokenCookie(this HttpResponse response, string refreshToken)
    {
        var options = CreateCookieOptions(response);
        options.MaxAge = RefreshTokenConsts.CookieMaxAge;
        response.Cookies.Append(ApiConstants.RefreshTokenCookieName, refreshToken, options);
    }

    public static void DeleteRefreshTokenCookie(this HttpResponse response)
        => response.Cookies.Delete(ApiConstants.RefreshTokenCookieName, CreateCookieOptions(response));
}
