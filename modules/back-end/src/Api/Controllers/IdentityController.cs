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
            ? Ok(new LoginToken(loginResult.Token))
            : Error<LoginToken>(loginResult.ErrorCode);
    }
}