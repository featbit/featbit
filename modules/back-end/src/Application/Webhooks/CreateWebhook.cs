using Application.Bases;
using Application.Bases.Exceptions;
using Application.Users;
using Domain.Webhooks;

namespace Application.Webhooks;

public class CreateWebhook : WebhookBase, IRequest<WebhookVm>
{
    public Guid OrgId { get; set; }

    public Webhook AsWebhook(Guid creatorId)
    {
        var webhook = new Webhook(OrgId, Name, Scopes, Url, Events, Headers, PayloadTemplateType, PayloadTemplate, Secret, IsActive, creatorId);
        return webhook;
    }
}

public class CreateWebhookValidator : AbstractValidator<CreateWebhook>
{
    public CreateWebhookValidator()
    {
       Include(new WebhookBaseValidator());
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