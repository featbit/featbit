using Application.Bases.Models;
using Domain.Webhooks;

namespace Application.Webhooks;

public class GetWebhookDeliveryList : IRequest<PagedResult<WebhookDelivery>>
{
    public Guid WebhookId { get; set; }

    public WebhookDeliveryFilter Filter { get; set; }
}

public class GetWebhookDeliveryListHandler : IRequestHandler<GetWebhookDeliveryList, PagedResult<WebhookDelivery>>
{
    private readonly IWebhookService _service;

    public GetWebhookDeliveryListHandler(IWebhookService service)
    {
        _service = service;
    }

    public async Task<PagedResult<WebhookDelivery>> Handle(GetWebhookDeliveryList request, CancellationToken cancellationToken)
    {
        var deliveries = await _service.GetDeliveriesAsync(request.WebhookId, request.Filter);
        return deliveries;
    }
}