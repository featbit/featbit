using Application.Members;
using Application.Policies;
using Application.Users;
using Application.Workspaces;

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

    // TODO remove
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

    [HttpPost("join-organization")]
    public async Task<ApiResponse<bool>> JoinOrganizationAsync(JoinOrganization request)
    {
        request.WorkspaceId = WorkspaceId;
        request.OrganizationId = OrgId;

        var result = await Mediator.Send(request);
        return Ok(result);
    }

    // TODO remove
    [HttpGet("workspace")]
    public async Task<ApiResponse<WorkspaceVm>> GetCurrentWorkspaceAsync()
    {
        var request = new GetCurrentWorkspace
        {
            UserId = CurrentUser.Id,
            WorkspaceId = WorkspaceId
        };

        var workspace = await Mediator.Send(request);
        return Ok(workspace);
    }
    
    [HttpGet("workspaces")]
    public async Task<ApiResponse<IEnumerable<WorkspaceVm>>> GetWorkspaces()
    {
        var request = new GetWorkspaces
        {
            UserId = CurrentUser.Id
        };
        
        var workspaces = await Mediator.Send(request);
        return Ok(workspaces);
    }
}