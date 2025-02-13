namespace Application.Webhooks;

public class DeleteWebhook : IRequest<bool>
{
    public Guid Id { get; set; }
}

public class DeleteWebhookHandler : IRequestHandler<DeleteWebhook, bool>
{
    private readonly IWebhookService _service;

    public DeleteWebhookHandler(IWebhookService service)
    {
        _service = service;
    }

    public async Task<bool> Handle(DeleteWebhook request, CancellationToken cancellationToken)
    {
        await _service.DeleteAsync(request.Id);
        return true;
    }
}