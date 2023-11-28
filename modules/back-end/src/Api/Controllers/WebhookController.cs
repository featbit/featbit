using Domain.Webhooks;
using Application.Webhooks;

namespace Api.Controllers;

[Route("api/v{version:apiVersion}/webhooks")]
public class WebhookController : ApiControllerBase
{
    [HttpPost]
    public async Task<ApiResponse<Webhook>> CreateAsync(CreateWebhook request)
    {
        request.OrgId = OrgId;

        var webhook = await Mediator.Send(request);

        return Ok(webhook);
    }

    [HttpGet("is-name-used")]
    public async Task<ApiResponse<bool>> IsNameUsedAsync([FromQuery] string name)
    {
        var request = new IsWebhookNameUsed
        {
            OrgId = OrgId,
            Name = name
        };

        var isNameUsed = await Mediator.Send(request);
        return Ok(isNameUsed);
    }
}