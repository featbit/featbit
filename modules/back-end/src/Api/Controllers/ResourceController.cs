using Application.Resources;

namespace Api.Controllers;

[Route("api/v{version:apiVersion}/organizations/{organizationId:guid}/resources")]
public class ResourceController : ApiControllerBase
{
    [HttpGet]
    public async Task<ApiResponse<IEnumerable<ResourceVm>>> GetListAsync(
        Guid organizationId,
        [FromQuery] ResourceFilter filter)
    {
        var request = new GetResourceList
        {
            OrganizationId = organizationId,
            Filter = filter
        };

        var vms = await Mediator.Send(request);
        return Ok(vms);
    }
}