using Application.Bases;
using Application.Bases.Exceptions;
using Application.Users;
using Domain.Webhooks;

namespace Application.Webhooks;

public class CreateWebhook : IRequest<Webhook>
{
    public Guid OrgId { get; set; }

    public string Name { get; set; }

    public string Url { get; set; }

    public string[] Events { get; set; }

    public KeyValuePair<string, string>[] Headers { get; set; }

    public string PayloadTemplate { get; set; }

    public string Secret { get; set; }

    public Webhook AsWebhook(Guid currentId)
    {
        var webhook = new Webhook(OrgId, Name, Url, Events, Headers, PayloadTemplate, Secret, currentId);
        return webhook;
    }
}

public class CreateWebhookValidator : AbstractValidator<CreateWebhook>
{
    public CreateWebhookValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("name"));

        RuleFor(x => x.Url)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("url"));

        RuleFor(x => x.Events)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("events"))
            .Must(x => x.All(y => WebhookEvents.All.Contains(y))).WithErrorCode(ErrorCodes.Invalid("events"));

        RuleFor(x => x.PayloadTemplate)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("payloadTemplate"));
    }
}

public class CreateWebhookHandler : IRequestHandler<CreateWebhook, Webhook>
{
    private readonly IWebhookService _service;
    private readonly ICurrentUser _currentUser;

    public CreateWebhookHandler(IWebhookService service, ICurrentUser currentUser)
    {
        _service = service;
        _currentUser = currentUser;
    }

    public async Task<Webhook> Handle(CreateWebhook request, CancellationToken cancellationToken)
    {
        if (await _service.IsNameUsedAsync(request.OrgId, request.Name))
        {
            throw new BusinessException(ErrorCodes.NameHasBeenUsed);
        }

        var webhook = request.AsWebhook(_currentUser.Id);
        await _service.AddOneAsync(webhook);

        return webhook;
    }
}