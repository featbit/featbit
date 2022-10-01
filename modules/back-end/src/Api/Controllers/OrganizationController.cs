using Application.Organizations;

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
    public async Task<ApiResponse<IEnumerable<OrganizationVm>>> GetListAsync()
    {
        var request = new GetOrganizationList { UserId = CurrentUser.Id };

        var vms = await Mediator.Send(request);
        return Ok(vms);
    }

    [HttpPost]
    public async Task<ApiResponse<OrganizationVm>> CreateAsync(CreateOrganization request)
    {
        var organization = await Mediator.Send(request);

        return Ok(organization);
    }

    [HttpPost("{id:guid}/add-user")]
    public async Task<ApiResponse<bool>> AddMemberByEmailAsync(Guid id, [FromBody] AddUser request)
    {
        request.OrganizationId = id;

        var success = await Mediator.Send(request);

        return Ok(success);
    }

    [HttpPut("{id:guid}/remove-user")]
    public async Task<ApiResponse<bool>> RemoveMemberAsync(Guid id, RemoveUser request)
    {
        request.OrganizationId = id;

        var success = await Mediator.Send(request);
        return Ok(success);
    }

    [HttpPost("{id:guid}/onboarding")]
    public async Task<ApiResponse<bool>> Onboarding(Guid id, [FromBody] Onboarding request)
    {
        request.OrganizationId = id;

        var success = await Mediator.Send(request);

        return Ok(success);
    }

    [HttpPut("{id:guid}")]
    public async Task<ApiResponse<OrganizationVm>> UpdateAsync(Guid id, UpdateOrganization request)
    {
        request.Id = id;

        var organization = await Mediator.Send(request);
        return Ok(organization);
    }

    [HttpDelete("{id:guid}")]
    public async Task<ApiResponse<bool>> DeleteAsync(Guid id)
    {
        var request = new DeleteOrganization
        {
            Id = id
        };

        var success = await Mediator.Send(request);
        return Ok(success);
    }
}