using Application.Users;

namespace Api.Controllers;

public class UserController : ApiControllerBase
{
    [HttpGet("profile")]
    public async Task<ApiResponse<Profile>> GetProfileAsync()
    {
        var request = new GetProfile();

        var profile = await Mediator.Send(request);
        return Ok(profile);
    }

    [HttpPut("profile")]
    public async Task<ApiResponse<Profile>> UpdateProfileAsync(UpdateProfile request)
    {
        var profile = await Mediator.Send(request);

        return Ok(profile);
    }

    [AllowAnonymous]
    [HttpPost("has-multiple-workspaces")]
    public async Task<ApiResponse<bool>> HasMultipleWorkspacesAsync(HasMultipleWorkspaces request)
    {
        var hasMultipleWorkspaces = await Mediator.Send(request);
        return Ok(hasMultipleWorkspaces);
    }
}