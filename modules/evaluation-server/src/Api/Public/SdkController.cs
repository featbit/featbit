using Domain.EndUsers;
using Streaming.Services;
using Microsoft.AspNetCore.Mvc;

namespace Api.Public;

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

        var bootstrap = payload.FeatureFlags.Select(x => new
        {
            x.Id,
            x.Variation,
            VariationId = x.VariationOptions.FirstOrDefault(y => y.Value == x.Variation)?.Id,
            x.VariationType,
            x.Timestamp,
            x.SendToExperiment
        });

        return new JsonResult(bootstrap);
    }
}