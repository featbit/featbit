using Domain.Webhooks;

namespace Application.Services;

public interface IWebhookSender
{
    Task<WebhookDelivery> SendAsync(Webhook webhook, Dictionary<string, object> dataObject);

    Task<WebhookDelivery> SendAsync(WebhookRequest request);
}