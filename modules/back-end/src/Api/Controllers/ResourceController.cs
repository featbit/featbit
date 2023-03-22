using Application.Resources;

namespace Api.Controllers;

[Route("api/v{version:apiVersion}/resources")]
public class ResourceController : ApiControllerBase
{
    [HttpGet]
    public async Task<ApiResponse<IEnumerable<ResourceVm>>> GetListAsync([FromQuery] ResourceFilter filter)
    {
        var request = new GetResourceList
        {
            OrganizationId = OrgId,
            Filter = filter
        };

        var vms = await Mediator.Send(request);
        return Ok(vms);
    }
}