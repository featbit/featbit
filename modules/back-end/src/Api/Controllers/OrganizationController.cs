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

    [HttpPost]
    [Authorize(LicenseFeatures.MultiOrg)]
    public async Task<ApiResponse<OrganizationVm>> CreateAsync(CreateOrganization request)
    {
        request.WorkspaceId = WorkspaceId;
        request.CurrentUserId = CurrentUser.Id;

        var organization = await Mediator.Send(request);

        return Ok(organization);
    }

    [HttpPost("add-user")]
    public async Task<ApiResponse<bool>> AddMemberByEmailAsync([FromBody] AddUser request)
    {
        request.WorkspaceId = WorkspaceId;
        request.OrganizationId = OrgId;

        var success = await Mediator.Send(request);

        return Ok(success);
    }

    [HttpPut("remove-user")]
    public async Task<ApiResponse<bool>> RemoveMemberAsync(RemoveUser request)
    {
        request.OrganizationId = OrgId;

        var success = await Mediator.Send(request);
        return Ok(success);
    }

    [HttpPost("onboarding")]
    public async Task<ApiResponse<bool>> Onboarding([FromBody] Onboarding request)
    {
        request.OrganizationId = OrgId;

        var success = await Mediator.Send(request);

        return Ok(success);
    }

    [HttpPut]
    public async Task<ApiResponse<OrganizationVm>> UpdateAsync(UpdateOrganizationName request)
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