using Application.Bases.Models;
using Application.Webhooks;
using Domain.Webhooks;

namespace Api.Controllers;

[Route("api/v{version:apiVersion}/webhooks")]
public class WebhookController : ApiControllerBase
{
    [HttpGet]
    public async Task<ApiResponse<PagedResult<WebhookVm>>> GetListAsync([FromQuery] WebhookFilter filter)
    {
        var request = new GetWebhookList
        {
            OrgId = OrgId,
            Filter = filter
        };

        var webhooks = await Mediator.Send(request);
        return Ok(webhooks);
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

    [HttpPost]
    public async Task<ApiResponse<WebhookVm>> CreateAsync(CreateWebhook request)
    {
        request.OrgId = OrgId;

        var vm = await Mediator.Send(request);
        return Ok(vm);
    }

    [HttpPut("{id:guid}")]
    public async Task<ApiResponse<WebhookVm>> UpdateAsync(Guid id, UpdateWebhook request)
    {
        request.Id = id;

        var vm = await Mediator.Send(request);
        return Ok(vm);
    }

    [HttpDelete("{id:guid}")]
    public async Task<ApiResponse<bool>> DeleteAsync(Guid id)
    {
        var request = new DeleteWebhook
        {
            Id = id
        };

        var success = await Mediator.Send(request);
        return Ok(success);
    }

    [HttpPost("send")]
    public async Task<ApiResponse<WebhookDelivery>> SendAsync(SendWebhook request)
    {
        var delivery = await Mediator.Send(request);
        return Ok(delivery);
    }

    [HttpGet("{id:guid}/deliveries")]
    public async Task<ApiResponse<PagedResult<WebhookDelivery>>> GetDeliveriesAsync(
        Guid id,
        [FromQuery] WebhookDeliveryFilter filter)
    {
        var request = new GetWebhookDeliveryList
        {
            WebhookId = id,
            Filter = filter
        };

        var deliveries = await Mediator.Send(request);
        return Ok(deliveries);
    }
}