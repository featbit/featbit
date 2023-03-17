using Domain.EndUsers;
using Domain.Services;
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
    public async Task<IActionResult> GetServerSideSdkPayloadAsync()
    {
        if (!Authenticated)
        {
            return Unauthorized();
        }

        var payload = await _dataSyncService.GetServerSdkPayloadAsync(EnvId, 0);
        return new JsonResult(payload);
    }

    [HttpGet("client/latest-all")]
    public async Task<IActionResult> GetClientSdkPayloadAsync([FromQuery] EndUser endUser)
    {
        if (!Authenticated)
        {
            return Unauthorized();
        }

        if (!endUser.IsValid())
        {
            return BadRequest("invalid end user");
        }

        var payload = await _dataSyncService.GetClientSdkPayloadAsync(EnvId, endUser, 0);
        return new JsonResult(payload);
    }
}