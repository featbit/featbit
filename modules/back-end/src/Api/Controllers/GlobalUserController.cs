using Application.Bases.Models;
using Application.GlobalUsers;
using Domain.EndUsers;

namespace Api.Controllers;

[Route("api/v{version:apiVersion}/global-users")]
public class GlobalUserController : ApiControllerBase
{
    [HttpGet]
    public async Task<ApiResponse<PagedResult<GlobalUser>>> GetListAsync([FromQuery] GlobalUserFilter filter)
    {
        var request = new GetGlobalUserList
        {
            Filter = filter
        };

        var users = await Mediator.Send(request);
        return Ok(users);
    }
}