using Application.Users;

namespace Application.Webhooks;

public class UpdateWebhook : IRequest<WebhookVm>
{
    public Guid Id { get; set; }

    public string Name { get; set; }

    public string[] Scopes { get; set; }

    public string Url { get; set; }

    public string[] Events { get; set; }

    public KeyValuePair<string, string>[] Headers { get; set; }

    public string PayloadTemplate { get; set; }

    public string Secret { get; set; }

    public bool IsActive { get; set; }
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