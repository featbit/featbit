using Application.Resources;
using Domain.Resources;

namespace Api.Controllers;

[ApiVersion(1.0)]
[ApiVersion(2.0)]
[Route("api/v{version:apiVersion}/resources")]
public class ResourceController : ApiControllerBase
{
    [HttpGet, MapToApiVersion(1.0)]
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

    [HttpGet, MapToApiVersion(2.0)]
    public async Task<ApiResponse<IEnumerable<ResourceV2>>> GetListAsyncV2([FromQuery] ResourceFilterV2 filter)
    {
        var request = new GetResourceListV2
        {
            SpaceId = filter.SpaceLevel == ResourceSpaceLevel.Workspace ? WorkspaceId : OrgId,
            Filter = filter
        };

        var resources = await Mediator.Send(request);
        return Ok(resources);
    }
}