using Application.Bases;
using Domain.Webhooks;

namespace Application.Webhooks;

public class TestWebhook : IRequest<WebhookDelivery>
{
    public Guid Id { get; set; }

    public string Payload { get; set; }

    public string Event { get; set; }
}

public class TestWebhookValidator : AbstractValidator<TestWebhook>
{
    public TestWebhookValidator()
    {
        RuleFor(x => x.Payload).NotEmpty().WithErrorCode(ErrorCodes.Required("payload"));
        RuleFor(x => x.Event).NotEmpty().WithErrorCode(ErrorCodes.Required("event"));
    }
}

public class TestWebhookHandler : IRequestHandler<TestWebhook, WebhookDelivery>
{
    private readonly IWebhookService _webhookService;
    private readonly IWebhookSender _webhookSender;

    public TestWebhookHandler(IWebhookService webhookService, IWebhookSender webhookSender)
    {
        _webhookService = webhookService;
        _webhookSender = webhookSender;
    }

    public async Task<WebhookDelivery> Handle(TestWebhook request, CancellationToken cancellationToken)
    {
        var webhook = await _webhookService.GetAsync(request.Id);

        var delivery = await _webhookSender.TestAsync(webhook, request.Payload, request.Event);
        return delivery;
    }
}