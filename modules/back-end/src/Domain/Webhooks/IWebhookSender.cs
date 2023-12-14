namespace Domain.Webhooks;

public interface IWebhookSender
{
    Task SendAsync(Webhook webhook, object dataObject);
}