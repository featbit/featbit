using System.Text.Json;
using Application.Bases;
using Domain.Utils;
using Domain.Webhooks;

namespace Application.Webhooks;

public class SendWebhook : WebhookRequest, IRequest<WebhookDelivery>
{
}

public class SendWebhookValidator : AbstractValidator<SendWebhook>
{
    public SendWebhookValidator()
    {
        RuleFor(x => x.DeliveryId)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("deliveryId"));

        RuleFor(x => x.Url)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("url"));

        RuleFor(x => x.Events)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("events"));

        RuleFor(x => x.Payload)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("payload"))
            .Must(x =>
            {
                try
                {
                    JsonDocument.Parse(x);
                    return true;
                }
                catch (JsonException)
                {
                    return false;
                }
            }).WithErrorCode(ErrorCodes.Invalid("payload"));
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
        var json = JsonDocument.Parse(request.Payload);
        if (request.PreventEmptyPayloads && json.RootElement.IsEmptyObject())
        {
            return WebhookDelivery.Ignored("Not allowed to send an empty JSON object", request.Url, request.Payload);
        }

        var delivery = await _webhookSender.SendAsync(request);
        return delivery;
    }
}