namespace Domain.Webhooks;

public interface IWebhookSender
{
    Task<WebhookDelivery> SendAsync(Webhook webhook, Dictionary<string, object> dataObject);

    Task<WebhookDelivery> TestAsync(Webhook webhook, string payload, string theEvent);
}