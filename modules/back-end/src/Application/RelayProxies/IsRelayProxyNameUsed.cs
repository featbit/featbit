namespace Application.RelayProxies;

public class IsRelayProxyNameUsed : IRequest<bool>
{
    public Guid OrganizationId { get; set; }

    public string Name { get; set; }
}

public class IsRelayProxyNameUsedHandler : IRequestHandler<IsRelayProxyNameUsed, bool>
{
    private readonly IRelayProxyService _service;

    public IsRelayProxyNameUsedHandler(IRelayProxyService service)
    {
        _service = service;
    }

    public async Task<bool> Handle(IsRelayProxyNameUsed request, CancellationToken cancellationToken)
    {
        var isNameUsed = await _service.AnyAsync(x =>
            x.OrganizationId == request.OrganizationId &&
            string.Equals(x.Name, request.Name, StringComparison.OrdinalIgnoreCase)
        );

        return isNameUsed;
    }
}