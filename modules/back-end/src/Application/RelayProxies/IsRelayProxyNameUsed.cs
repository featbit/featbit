namespace Application.RelayProxies;

public class IsRelayProxyNameUsed : IRequest<bool>
{
    public Guid OrganizationId { get; set; }

    public string Name { get; set; }
}

public class IsRelayProxyNameUsedHandler(IRelayProxyService service) : IRequestHandler<IsRelayProxyNameUsed, bool>
{
    public async Task<bool> Handle(IsRelayProxyNameUsed request, CancellationToken cancellationToken) =>
        await service.IsNameUsedAsync(request.OrganizationId, request.Name);
}