namespace Domain.Webhooks;

public interface IWebhookSender
{
    Task<WebhookDelivery> SendAsync(Webhook webhook, Dictionary<string, object> dataObject);
}