using Application.Resources;
using Domain.Resources;

namespace Api.Controllers;

[Route("api/v{version:apiVersion}/resources")]
public class ResourceController : ApiControllerBase
{
    [HttpGet]
    public async Task<ApiResponse<IEnumerable<Resource>>> GetListAsync([FromQuery] ResourceFilter filter)
    {
        var request = new GetResourceList
        {
            OrganizationId = OrgId,
            Filter = filter
        };

        var resources = await Mediator.Send(request);
        return Ok(resources);
    }
}