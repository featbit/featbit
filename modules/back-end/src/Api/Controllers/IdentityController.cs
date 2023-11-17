using Application.Identity;

namespace Api.Controllers;

public class IdentityController : ApiControllerBase
{
    [HttpPost]
    [AllowAnonymous]
    [Route("login-by-email")]
    public async Task<ApiResponse<LoginToken>> LoginByEmailAsync(LoginByEmail request)
    {
        var loginResult = await Mediator.Send(request);

        return loginResult.Success
            ? Ok(new LoginToken(false, loginResult.Token))
            : Error<LoginToken>(loginResult.ErrorCode);
    }

    [HttpPut("reset-password")]
    public async Task<ApiResponse<ResetPasswordResult>> ResetPasswordAsync(ResetPassword request)
    {
        var resetPasswordResult = await Mediator.Send(request);

        return Ok(resetPasswordResult);
    }
}