using Application.Bases.Models;
using Domain.Webhooks;

namespace Application.Webhooks;

public class GetWebhookDeliveryList : IRequest<PagedResult<WebhookDelivery>>
{
    public Guid WebhookId { get; set; }

    public WebhookDeliveryFilter Filter { get; set; }
}

public class GetWebhookDeliveryListHandler(IWebhookService service)
    : IRequestHandler<GetWebhookDeliveryList, PagedResult<WebhookDelivery>>
{
    public async Task<PagedResult<WebhookDelivery>> Handle(GetWebhookDeliveryList request, CancellationToken cancellationToken)
    {
        var deliveries = await service.GetDeliveriesAsync(request.WebhookId, request.Filter);
        return deliveries;
    }
}