using Application.Identity;

namespace Api.Controllers;

public class IdentityController : ApiControllerBase
{
    [HttpPost]
    [AllowAnonymous]
    [Route("login-by-password")]
    public async Task<ApiResponse> LoginByPasswordAsync(LoginByPassword request)
    {
        var loginResult = await Mediator.Send(request);

        return loginResult.Success
            ? ApiResponse.Ok(new { token = loginResult.Token })
            : ApiResponse.Error(loginResult.ErrorCode);
    }
}