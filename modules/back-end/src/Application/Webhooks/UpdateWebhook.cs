using Application.Users;

namespace Application.Webhooks;

public class UpdateWebhook : WebhookBase, IRequest<WebhookVm>
{
    public Guid Id { get; set; }
}

public class UpdateWebhookValidator : AbstractValidator<UpdateWebhook>
{
    public UpdateWebhookValidator()
    {
        Include(new WebhookBaseValidator());
    }
}

public class UpdateWebhookHandler : IRequestHandler<UpdateWebhook, WebhookVm>
{
    private readonly IWebhookService _service;
    private readonly ICurrentUser _currentUser;
    private readonly IMapper _mapper;

    public UpdateWebhookHandler(IWebhookService service, ICurrentUser currentUser, IMapper mapper)
    {
        _service = service;
        _currentUser = currentUser;
        _mapper = mapper;
    }

    public async Task<WebhookVm> Handle(UpdateWebhook request, CancellationToken cancellationToken)
    {
        var webhook = await _service.GetAsync(request.Id);
        webhook.Update(
            request.Name,
            request.Scopes,
            request.Url,
            request.Events,
            request.Headers,
            request.PayloadTemplateType,
            request.PayloadTemplate,
            request.Secret,
            request.IsActive,
            _currentUser.Id
        );

        await _service.UpdateAsync(webhook);

        var vm = _mapper.Map<WebhookVm>(webhook);
        return vm;
    }
}