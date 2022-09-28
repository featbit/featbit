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
}