using Api.Authentication;
using Microsoft.AspNetCore.Authorization;
using Api.RateLimiting;
using Domain.EndUsers;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Streaming.Services;

namespace Api.Public;

[Route("api/public/sdk")]
[EnableRateLimiting(RateLimitingPolicies.Sdk)]
public class SdkController : PublicApiControllerBase
{
    private readonly IDataSyncService _dataSyncService;

    public SdkController(IDataSyncService dataSyncService)
    {
        _dataSyncService = dataSyncService;
    }

    [Authorize(Policy = FeatBitPolicies.ServerSecretOnly)]
    [HttpGet("server/latest-all")]
    public async Task<IActionResult> GetServerSideSdkPayloadAsync([FromQuery] long timestamp = 0)
    {
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

    [Authorize(Policy = FeatBitPolicies.ClientSecretOnly)]
    [HttpPost("client/latest-all")]
    public async Task<IActionResult> GetClientSdkPayloadAsync(EndUser endUser, [FromQuery] long timestamp = 0)
    {
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