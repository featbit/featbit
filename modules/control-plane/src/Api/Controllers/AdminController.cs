using Api.Application.Admin;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers;

[Route("api/admin")]
[Authorize(AuthenticationSchemes = "ApiKey")]
public class AdminController : ApiControllerBase
{
    [HttpPost("push-eval-full-sync")]
    public async Task<ApiResponse<bool>> PushFullSyncToAllActiveSdks()
    {
        var request = new PushFullSync();

        var response = await Mediator.Send(request);
        return Ok(response);
    }

    [HttpGet("connections")]
    public async Task<ApiResponse<IReadOnlyList<ConnectionDto>>> GetConnections()
    {
        var request = new GetConnections();

        var response = await Mediator.Send(request);
        return Ok(response);
    }
}