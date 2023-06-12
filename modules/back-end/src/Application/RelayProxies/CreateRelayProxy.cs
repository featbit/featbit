using Application.Bases;
using Domain.RelayProxies;

namespace Application.RelayProxies;

public class CreateRelayProxy : IRequest<RelayProxy>
{
    public Guid OrganizationId { get; set; }

    public string Name { get; set; }

    public string Description { get; set; }

    public bool IsAllEnvs { get; set; }

    public IEnumerable<Scope> Scopes { get; set; }

    public IEnumerable<Agent> Agents { get; set; }

    public RelayProxy AsRelayProxy()
    {
        return new RelayProxy(OrganizationId, Name, Description, IsAllEnvs, Scopes, Agents);
    }
}

public class CreateRelayProxyValidator : AbstractValidator<CreateRelayProxy>
{
    public CreateRelayProxyValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithErrorCode(ErrorCodes.NameIsRequired);

        RuleFor(x => x.Scopes)
            .Must((proxy, scopes) =>
            {
                if (proxy.IsAllEnvs)
                {
                    return true;
                }

                return scopes?.All(scope => scope.IsValid()) ?? false;
            })
            .WithErrorCode(ErrorCodes.InvalidRelayProxyScope);

        RuleFor(x => x.Agents)
            .NotEmpty()
            .Must(agents => agents.All(agent => agent.IsValid()))
            .WithErrorCode(ErrorCodes.InvalidRelayProxyAgent);
    }
}

public class CreateRelayProxyHandler : IRequestHandler<CreateRelayProxy, RelayProxy>
{
    private readonly IRelayProxyService _service;

    public CreateRelayProxyHandler(IRelayProxyService service)
    {
        _service = service;
    }

    public async Task<RelayProxy> Handle(CreateRelayProxy request, CancellationToken cancellationToken)
    {
        var relayProxy = request.AsRelayProxy();
        await _service.AddOneAsync(relayProxy);

        return relayProxy;
    }
}