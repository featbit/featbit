using Application.Identity;

namespace Api.Controllers;

public class IdentityController : ApiControllerBase
{
    [HttpPost]
    [AllowAnonymous]
    [Route("login-by-password")]
    public async Task<ApiResponse<LoginToken>> LoginByPasswordAsync(LoginByPassword request)
    {
        var loginResult = await Mediator.Send(request);

        return loginResult.Success
            ? Ok(new LoginToken(loginResult.Token))
            : Error<LoginToken>(loginResult.ErrorCode);
    }
}