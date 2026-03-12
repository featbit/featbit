using Application.Identity;

namespace Api.Controllers;

public class IdentityController : ApiControllerBase
{
    [HttpPost]
    [AllowAnonymous]
    [Route("login-by-email")]
    public async Task<ApiResponse<LoginToken>> LoginByEmailAsync(LoginByEmail request)
    {
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();
        request.IpAddress = ipAddress;
        
        var loginResult = await Mediator.Send(request);

        if (!loginResult.Success)
        {
            return Error<LoginToken>(loginResult.ErrorCode);
        }

        // Set refresh token in HttpOnly cookie
        var cookieOptions = new CookieOptions
        {
            HttpOnly = true,
            Secure = false, // dev only if using http
            SameSite = SameSiteMode.Lax,
            Expires = DateTimeOffset.UtcNow.AddDays(30),
            Path = ApiConstants.RefreshTokenCookiePath
        };

        Response.Cookies.Append(ApiConstants.RefreshTokenCookieName, loginResult.RefreshToken, cookieOptions);

        return Ok(new LoginToken(false, loginResult.AccessToken));
    }
    
    [HttpPost]
    [AllowAnonymous]
    [Route("refresh-token")]
    public async Task<ApiResponse<LoginToken>> RefreshTokenAsync()
    {
        if (!Request.Cookies.TryGetValue(ApiConstants.RefreshTokenCookieName, out var refreshToken))
        {
            Response.StatusCode = StatusCodes.Status401Unauthorized;
            return Error<LoginToken>("REFRESH_TOKEN_NOT_FOUND");
        }
        
        // Get client IP address
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();
        
        var refreshRequest = new RefreshToken 
        { 
            Token = refreshToken,
            IpAddress = ipAddress ?? string.Empty
        };
        
        var refreshResult = await Mediator.Send(refreshRequest);
    
        if (!refreshResult.Success)
        {
            Response.Cookies.Delete(ApiConstants.RefreshTokenCookieName, new CookieOptions { Path = ApiConstants.RefreshTokenCookiePath });
            Response.StatusCode = StatusCodes.Status401Unauthorized;
            return Error<LoginToken>(refreshResult.ErrorCode);
        }
        
        var cookieOptions = new CookieOptions
        {
            HttpOnly = true,
            Secure = false,
            SameSite = SameSiteMode.Lax,
            Expires = DateTimeOffset.UtcNow.AddDays(30),
            Path = ApiConstants.RefreshTokenCookiePath
        };

        Response.Cookies.Append(ApiConstants.RefreshTokenCookieName, refreshResult.RefreshToken, cookieOptions);
        
        return Ok(new LoginToken(false, refreshResult.AccessToken));
    }

    [HttpPost]
    [Route("logout")]
    public async Task<ApiResponse<bool>> LogoutAsync()
    {
        // Get refresh token from cookie
        if (Request.Cookies.TryGetValue(ApiConstants.RefreshTokenCookieName, out var refreshToken))
        {
            // Get client IP address
            var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();
            
            // Revoke the refresh token
            var revokeRequest = new RevokeRefreshToken
            {
                Token = refreshToken,
                IpAddress = ipAddress
            };
            
            await Mediator.Send(revokeRequest);
        }

        // Clear refresh token cookie
        Response.Cookies.Delete(ApiConstants.RefreshTokenCookieName, new CookieOptions 
        { 
            Path = ApiConstants.RefreshTokenCookiePath 
        });

        return Ok(true);
    }
    
    [HttpPut("reset-password")]
    public async Task<ApiResponse<ResetPasswordResult>> ResetPasswordAsync(ResetPassword request)
    {
        var resetPasswordResult = await Mediator.Send(request);

        return Ok(resetPasswordResult);
    }
}