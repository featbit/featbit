using Application.Bases;
using Domain.RelayProxies;

namespace Application.RelayProxies;

public class UpdateRelayProxy : IRequest<bool>
{
    public Guid Id { get; set; }

    public string Name { get; set; }

    public string Description { get; set; }

    public bool IsAllEnvs { get; set; }

    public IEnumerable<Scope> Scopes { get; set; }

    public IEnumerable<Agent> Agents { get; set; }
}

public class UpdateRelayProxyValidator : AbstractValidator<UpdateRelayProxy>
{
    public UpdateRelayProxyValidator()
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

public class UpdateRelayProxyHandler : IRequestHandler<UpdateRelayProxy, bool>
{
    private readonly IRelayProxyService _service;

    public UpdateRelayProxyHandler(IRelayProxyService service)
    {
        _service = service;
    }

    public async Task<bool> Handle(UpdateRelayProxy request, CancellationToken cancellationToken)
    {
        var relayProxy = await _service.GetAsync(request.Id);
        relayProxy.Update(request.Name, request.Description, request.IsAllEnvs, request.Scopes, request.Agents);

        await _service.UpdateAsync(relayProxy);

        return true;
    }
}