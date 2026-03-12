using Application.Identity;

namespace Api.Controllers;

public class IdentityController : ApiControllerBase
{
    [HttpPost]
    [AllowAnonymous]
    [Route("login-by-email")]
    public async Task<ApiResponse<LoginToken>> LoginByEmailAsync(LoginByEmail request)
    {
        request.IpAddress = Request.ClientIpAddress();

        var loginResult = await Mediator.Send(request);
        if (!loginResult.Success)
        {
            return Error<LoginToken>(loginResult.ErrorCode);
        }

        var (accessToken, refreshToken) = loginResult.Tokens;

        // set refresh token cookie
        Response.SetRefreshTokenCookie(refreshToken);

        return Ok(new LoginToken(false, accessToken));
    }

    [HttpPost]
    [AllowAnonymous]
    [Route("refresh-token")]
    public async Task<ActionResult<ApiResponse<LoginToken>>> RefreshTokenAsync()
    {
        var currentRefreshToken = Request.RefreshToken();
        if (string.IsNullOrWhiteSpace(currentRefreshToken))
        {
            return Unauthorized(Error<LoginToken>("REFRESH_TOKEN_NOT_FOUND"));
        }

        var refreshRequest = new RefreshTokens
        {
            Token = currentRefreshToken,
            IpAddress = Request.ClientIpAddress()
        };

        var refreshResult = await Mediator.Send(refreshRequest);
        if (!refreshResult.Success)
        {
            Response.DeleteRefreshTokenCookie();
            return Unauthorized(Error<LoginToken>(refreshResult.ErrorCode));
        }

        var (accessToken, refreshToken) = refreshResult.Tokens;

        // set new refresh token cookie
        Response.SetRefreshTokenCookie(refreshToken);

        return Ok(new LoginToken(false, accessToken));
    }

    [HttpPost]
    [Route("logout")]
    public async Task<ApiResponse<bool>> LogoutAsync()
    {
        var refreshToken = Request.RefreshToken();
        if (string.IsNullOrWhiteSpace(refreshToken))
        {
            return Ok(true);
        }

        // revoke the refresh token
        var revokeRequest = new RevokeRefreshToken
        {
            Token = refreshToken,
            IpAddress = Request.ClientIpAddress()
        };
        await Mediator.Send(revokeRequest);

        // delete refresh token cookie
        Response.DeleteRefreshTokenCookie();

        return Ok(true);
    }

    [HttpPut("reset-password")]
    public async Task<ApiResponse<ResetPasswordResult>> ResetPasswordAsync(ResetPassword request)
    {
        var resetPasswordResult = await Mediator.Send(request);

        return Ok(resetPasswordResult);
    }
}