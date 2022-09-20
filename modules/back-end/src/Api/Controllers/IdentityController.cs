using Application.Identity;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers;

public class IdentityController : ApiControllerBase
{
    [HttpPost]
    [AllowAnonymous]
    [Route("login-by-password")]
    public async Task<LoginResult> LoginByPasswordAsync(LoginByPassword request)
    {
        return await Mediator.Send(request);
    }
}