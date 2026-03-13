using Domain.EndUsers;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Streaming.Services;

namespace Api.Public;

[EnableRateLimiting("Sdk")]
public class SdkController : PublicApiControllerBase
{
    private readonly IDataSyncService _dataSyncService;

    public SdkController(IDataSyncService dataSyncService)
    {
        _dataSyncService = dataSyncService;
    }

    [HttpGet("server/latest-all")]
    public async Task<IActionResult> GetServerSideSdkPayloadAsync([FromQuery] long timestamp = 0)
    {
        if (!Authenticated)
        {
            return Unauthorized();
        }

        var payload = await _dataSyncService.GetServerSdkPayloadAsync(EnvId, timestamp);
        if (payload.IsEmpty())
        {
            return Ok();
        }

        var bootstrap = new
        {
            messageType = "data-sync",
            data = payload
        };

        return new JsonResult(bootstrap);
    }

    [HttpPost("client/latest-all")]
    public async Task<IActionResult> GetClientSdkPayloadAsync(EndUser endUser, [FromQuery] long timestamp = 0)
    {
        if (!Authenticated)
        {
            return Unauthorized();
        }

        if (!endUser.IsValid())
        {
            return BadRequest("invalid end user");
        }

        var payload = await _dataSyncService.GetClientSdkPayloadAsync(EnvId, endUser, timestamp);
        if (payload.IsEmpty())
        {
            return Ok();
        }

        var bootstrap = new
        {
            messageType = "data-sync",
            data = payload
        };

        return new JsonResult(bootstrap);
    }
}