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

    public UpdateWebhookHandler(IWebhookService service, ICurrentUser currentUser)
    {
        _service = service;
        _currentUser = currentUser;
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
            request.PreventEmptyPayloads,
            _currentUser.Id
        );

        await _service.UpdateAsync(webhook);

        var vm = WebhookMapper.ToVm(webhook);
        return vm;
    }
}