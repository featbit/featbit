using Application.Organizations;

namespace Api.Controllers;

public class OrganizationController : ApiControllerBase
{
    [HttpGet("{id}")]
    public async Task<ApiResponse<OrganizationVm>> GetAsync(string id)
    {
        var request = new GetOrganization { Id = id };

        var vm = await Mediator.Send(request);
        return Ok(vm);
    }

    [HttpGet]
    public async Task<ApiResponse<IEnumerable<OrganizationVm>>> GetUserOrganizationAsync()
    {
        var request = new GetUserOrganization { UserId = CurrentUser.Id };

        var vms = await Mediator.Send(request);
        return Ok(vms);
    }
}