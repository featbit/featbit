using Api.Authorization;
using Microsoft.AspNetCore.Authorization;
using Api.RateLimiting;
using Domain.EndUsers;
using Domain.Messages;
using Domain.Usages;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Streaming.Services;

namespace Api.Public;

[Route("api/public/sdk")]
[EnableRateLimiting(RateLimitingPolicies.Sdk)]
public class SdkController(IDataSyncService dataSyncService, IMessageProducer producer) : ApiControllerBase
{
    [HttpGet("server/latest-all")]
    [Authorize(SecretPolicies.ServerOnly)]
    public async Task<IActionResult> GetServerSideSdkPayloadAsync([FromQuery] long timestamp = 0)
    {
        var payload = await dataSyncService.GetServerSdkPayloadAsync(EnvId, timestamp);
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
    [Authorize(SecretPolicies.ClientOnly)]
    public async Task<IActionResult> GetClientSdkPayloadAsync(EndUser endUser, [FromQuery] long timestamp = 0)
    {
        if (!endUser.IsValid())
        {
            return BadRequest("invalid end user");
        }

        var payload = await dataSyncService.GetClientSdkPayloadAsync(EnvId, endUser, timestamp);

        var usage = new InsightUsage(EnvId);
        usage.AddUser(endUser.KeyId);
        await producer.PublishAsync(Topics.Usage, usage);

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
