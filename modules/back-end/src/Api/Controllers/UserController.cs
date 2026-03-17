using Application.Members;
using Application.Policies;
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

    [HttpGet("policies")]
    public async Task<ApiResponse<IEnumerable<PolicyVm>>> GetPoliciesAsync()
    {
        var request = new GetMemberPolicy
        {
            OrganizationId = OrgId,
            MemberId = CurrentUser.Id
        };

        var policies = await Mediator.Send(request);
        return Ok(policies);
    }
}