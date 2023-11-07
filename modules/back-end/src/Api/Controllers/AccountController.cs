using Application.Identity;

namespace Api.Controllers;

[Route("api/v{version:apiVersion}/accounts")]
public class AccountController : ApiControllerBase
{
    [AllowAnonymous]
    [HttpPost("has-multiple-accounts")]
    public async Task<ApiResponse<bool>> GetAsync(HasMultipleAccounts request)
    {
        var vm = await Mediator.Send(request);
        return Ok(vm);
    }
}