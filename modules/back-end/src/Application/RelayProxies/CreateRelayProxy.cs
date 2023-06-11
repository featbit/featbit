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

public class CreateAccessTokenValidator : AbstractValidator<CreateRelayProxy>
{
    public CreateAccessTokenValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithErrorCode(ErrorCodes.NameIsRequired);

        RuleFor(x => x)
            .Must(y =>
            {
                var scopes = y.Scopes;
                return y.IsAllEnvs || (scopes.Any() && 
                       scopes.All(scope => !string.IsNullOrWhiteSpace(scope.Id) && 
                                           !string.IsNullOrWhiteSpace(scope.ProjectId) && 
                                           scope.EnvIds.Any()));   
            })
            .WithErrorCode(ErrorCodes.RelayProxyScopeInvalid);
        
        RuleFor(x => x.Agents)
            .Must(agents =>
            {
                return agents.Any() && 
                       agents.All(scope => !string.IsNullOrWhiteSpace(scope.Id) && 
                                           !string.IsNullOrWhiteSpace(scope.Name) && 
                                           !string.IsNullOrWhiteSpace(scope.Host));   
            })
            .WithErrorCode(ErrorCodes.RelayProxyAgentInvalid);
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