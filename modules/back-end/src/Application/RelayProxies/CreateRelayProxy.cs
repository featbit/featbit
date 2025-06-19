using Domain.RelayProxies;

namespace Application.RelayProxies;

public class CreateRelayProxy : RelayProxyBase, IRequest<RelayProxy>
{
    public Guid OrganizationId { get; set; }

    public RelayProxy AsRelayProxy()
    {
        return new RelayProxy(OrganizationId, Name, Description, IsAllEnvs, Scopes, Agents);
    }
}

public class CreateRelayProxyValidator : AbstractValidator<CreateRelayProxy>
{
    public CreateRelayProxyValidator()
    {
        Include(new WebhookBaseValidator());
    }
}

public class CreateRelayProxyHandler(IRelayProxyService service) : IRequestHandler<CreateRelayProxy, RelayProxy>
{
    public async Task<RelayProxy> Handle(CreateRelayProxy request, CancellationToken cancellationToken)
    {
        var relayProxy = request.AsRelayProxy();
        await service.AddOneAsync(relayProxy);

        return relayProxy;
    }
}