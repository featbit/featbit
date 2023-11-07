using Application.Identity;

namespace Api.Controllers;

[Route("api/v{version:apiVersion}/workspaces")]
public class WorkspaceController : ApiControllerBase
{
    [AllowAnonymous]
    [HttpPost("has-multiple-workspaces")]
    public async Task<ApiResponse<bool>> GetAsync(HasMultipleWorkspaces request)
    {
        var vm = await Mediator.Send(request);
        return Ok(vm);
    }
}