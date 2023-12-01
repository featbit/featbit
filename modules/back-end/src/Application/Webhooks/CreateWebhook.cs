using Application.Bases;
using Application.Bases.Exceptions;
using Application.Users;
using Domain.Webhooks;

namespace Application.Webhooks;

public class CreateWebhook : IRequest<WebhookVm>
{
    public Guid OrgId { get; set; }

    public string Name { get; set; }

    public string[] Scopes { get; set; }

    public string Url { get; set; }

    public string[] Events { get; set; }

    public KeyValuePair<string, string>[] Headers { get; set; }

    public string PayloadTemplate { get; set; }

    public string Secret { get; set; }

    public bool IsActive { get; set; }

    public Webhook AsWebhook(Guid creatorId)
    {
        var webhook = new Webhook(OrgId, Name, Scopes, Url, Events, Headers, PayloadTemplate, Secret, IsActive, creatorId);
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

        RuleFor(x => x.Scopes)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("scopes"));

        RuleFor(x => x.Events)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("events"))
            .Must(x => x.All(y => WebhookEvents.All.Contains(y))).WithErrorCode(ErrorCodes.Invalid("events"));

        RuleFor(x => x.PayloadTemplate)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("payloadTemplate"));
    }
}

public class CreateWebhookHandler : IRequestHandler<CreateWebhook, WebhookVm>
{
    private readonly IWebhookService _service;
    private readonly ICurrentUser _currentUser;
    private readonly IMapper _mapper;

    public CreateWebhookHandler(IWebhookService service, ICurrentUser currentUser, IMapper mapper)
    {
        _service = service;
        _currentUser = currentUser;
        _mapper = mapper;
    }

    public async Task<WebhookVm> Handle(CreateWebhook request, CancellationToken cancellationToken)
    {
        if (await _service.IsNameUsedAsync(request.OrgId, request.Name))
        {
            throw new BusinessException(ErrorCodes.NameHasBeenUsed);
        }

        var webhook = request.AsWebhook(_currentUser.Id);
        await _service.AddOneAsync(webhook);

        var vm = _mapper.Map<Webhook, WebhookVm>(webhook);
        return vm;
    }
}