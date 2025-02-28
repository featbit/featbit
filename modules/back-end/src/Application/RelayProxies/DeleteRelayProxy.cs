namespace Application.RelayProxies;

public class DeleteRelayProxy : IRequest<bool>
{
    public Guid Id { get; set; }
}

public class DeleteRelayProxyHandler(IRelayProxyService service) : IRequestHandler<DeleteRelayProxy, bool>
{
    public async Task<bool> Handle(DeleteRelayProxy request, CancellationToken cancellationToken)
    {
        await service.DeleteOneAsync(request.Id);

        return true;
    }
}