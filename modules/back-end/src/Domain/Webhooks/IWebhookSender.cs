namespace Domain.Webhooks;

public interface IWebhookSender
{
    Task SendAsync(Webhook webhook, Dictionary<string, object> dataObject);
}