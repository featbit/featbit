using Domain.RefreshTokens;

namespace Api;

public static class HttpResponseExtensions
{
    private static readonly CookieOptions CreateRefreshTokenCookieOptions = new()
    {
        // prevent client-side scripts from accessing the cookie, which can help mitigate XSS attacks
        HttpOnly = true,

        // we'd better set to true to ensure the cookie is only sent over HTTPS and this should be an option that
        // can be configured through environment variables, for now we set it to false to make it works in any environment
        Secure = false,

        // we need to allow cookies are sent on cross-site XHR/fetch with withCredentials
        SameSite = SameSiteMode.Lax,

        MaxAge = RefreshTokenConsts.CookieMaxAge,
        Path = ApiConstants.RefreshTokenCookiePath
    };

    private static readonly CookieOptions DeleteRefreshTokenCookieOptions = new()
    {
        Path = ApiConstants.RefreshTokenCookiePath
    };

    public static void SetRefreshTokenCookie(this HttpResponse response, string refreshToken)
        => response.Cookies.Append(ApiConstants.RefreshTokenCookieName, refreshToken, CreateRefreshTokenCookieOptions);

    public static void DeleteRefreshTokenCookie(this HttpResponse response)
        => response.Cookies.Delete(ApiConstants.RefreshTokenCookieName, DeleteRefreshTokenCookieOptions);
}