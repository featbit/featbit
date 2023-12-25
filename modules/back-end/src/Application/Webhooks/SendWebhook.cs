using Domain.Webhooks;

namespace Application.Webhooks;

public class SendWebhook : IRequest<WebhookDelivery>
{
    public WebhookRequest Request { get; set; }

    public SendWebhook(WebhookRequest request)
    {
        Request = request;
    }
}

public class SendWebhookHandler : IRequestHandler<SendWebhook, WebhookDelivery>
{
    private readonly IWebhookSender _webhookSender;

    public SendWebhookHandler(IWebhookSender webhookSender)
    {
        _webhookSender = webhookSender;
    }

    public async Task<WebhookDelivery> Handle(SendWebhook request, CancellationToken cancellationToken)
    {
        var delivery = await _webhookSender.SendAsync(request.Request);
        return delivery;
    }
}