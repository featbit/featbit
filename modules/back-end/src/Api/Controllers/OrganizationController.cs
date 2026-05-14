using Application.Bases.Models;
using Application.Members;
using Application.Organizations;
using Domain.Workspaces;

namespace Api.Controllers;

[Route("api/v{version:apiVersion}/organizations")]
public class OrganizationController : ApiControllerBase
{
    [HttpGet("{id:guid}")]
    public async Task<ApiResponse<OrganizationVm>> GetAsync(Guid id)
    {
        var request = new GetOrganization { Id = id };

        var vm = await Mediator.Send(request);
        return Ok(vm);
    }

    [HttpGet]
    public async Task<ApiResponse<IEnumerable<OrganizationVm>>> GetListAsync([FromQuery(Name = "isSsoFirstLogin")] bool isSsoFirstLogin = false)
    {
        var request = new GetOrganizationList
        {
            UserId = CurrentUser.Id,
            WorkspaceId = WorkspaceId,
            IsSsoFirstLogin = isSsoFirstLogin
        };

        var vms = await Mediator.Send(request);
        return Ok(vms);
    }

    [HttpGet("is-key-used")]
    public async Task<ApiResponse<bool>> IsKeyUsedAsync(string key)
    {
        var request = new IsKeyUsed
        {
            WorkspaceId = WorkspaceId,
            Key = key
        };

        var isUsed = await Mediator.Send(request);
        return Ok(isUsed);
    }

    [HttpPost]
    [Authorize(LicenseFeatures.MultiOrg)]
    public async Task<ApiResponse<OrganizationVm>> CreateAsync(CreateOrganization request)
    {
        request.WorkspaceId = WorkspaceId;
        request.CurrentUserId = CurrentUser.Id;

        var organization = await Mediator.Send(request);

        return Ok(organization);
    }

    [HttpGet("members")]
    public async Task<ApiResponse<PagedResult<MemberVm>>> GetMembersAsync([FromQuery] MemberFilter filter)
    {
        var request = new GetMemberList
        {
            OrganizationId = OrgId,
            Filter = filter
        };

        var members = await Mediator.Send(request);
        return Ok(members);
    }

    [HttpPost("onboarding")]
    public async Task<ApiResponse<bool>> Onboarding([FromBody] Onboarding request)
    {
        request.OrganizationId = OrgId;

        var success = await Mediator.Send(request);

        return Ok(success);
    }

    [HttpPut]
    public async Task<ApiResponse<OrganizationVm>> UpdateAsync(UpdateOrganization request)
    {
        request.Id = OrgId;

        var organization = await Mediator.Send(request);
        return Ok(organization);
    }

    [HttpDelete]
    public async Task<ApiResponse<bool>> DeleteAsync()
    {
        var request = new DeleteOrganization
        {
            Id = OrgId
        };

        var success = await Mediator.Send(request);
        return Ok(success);
    }
}