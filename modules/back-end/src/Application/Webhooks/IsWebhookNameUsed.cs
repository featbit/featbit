namespace Application.Webhooks;

public class IsWebhookNameUsed : IRequest<bool>
{
    public Guid OrgId { get; set; }

    public string Name { get; set; }
}

public class IsWebhookNameUsedHandler : IRequestHandler<IsWebhookNameUsed, bool>
{
    private readonly IWebhookService _service;

    public IsWebhookNameUsedHandler(IWebhookService service)
    {
        _service = service;
    }

    public async Task<bool> Handle(IsWebhookNameUsed request, CancellationToken cancellationToken)
    {
        return await _service.IsNameUsedAsync(request.OrgId, request.Name);
    }
}