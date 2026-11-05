using Application.Bases.Models;
using Application.Members;
using Application.Policies;
using Application.Users;
using Application.Workspaces;

namespace Api.Controllers;

public class UserController : ApiControllerBase
{
    /// <summary>
    /// Get a lightweight member list for the current organization
    /// </summary>
    /// <remarks>
    /// Returns member identifiers, names, and email addresses for authenticated member pickers.
    /// This endpoint does not require IAM management permission.
    /// </remarks>
    [HttpGet("organization-members")]
    public async Task<ApiResponse<PagedResult<MemberLookupVm>>> GetOrganizationMembersAsync(
        [FromQuery] MemberFilter filter)
    {
        var request = new GetMemberLookupList
        {
            OrganizationId = OrgId,
            Filter = filter
        };

        var members = await Mediator.Send(request);
        return Ok(members);
    }

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

    [HttpGet("workspaces")]
    public async Task<ApiResponse<ICollection<WorkspaceVm>>> GetWorkspaces()
    {
        var request = new GetWorkspaces
        {
            UserId = CurrentUser.Id
        };

        var workspaces = await Mediator.Send(request);
        return Ok(workspaces);
    }
}
