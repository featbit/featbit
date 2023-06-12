namespace Application.RelayProxies;

public class DeleteRelayProxy : IRequest<bool>
{
    public Guid Id { get; set; }
}

public class DeleteRelayProxyHandler : IRequestHandler<DeleteRelayProxy, bool>
{
    private readonly IRelayProxyService _service;

    public DeleteRelayProxyHandler(IRelayProxyService service)
    {
        _service = service;
    }

    public async Task<bool> Handle(DeleteRelayProxy request, CancellationToken cancellationToken)
    {
        await _service.DeleteAsync(request.Id);

        return true;
    }
}