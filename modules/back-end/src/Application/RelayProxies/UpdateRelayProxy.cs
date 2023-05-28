using Application.Bases;
using Domain.RelayProxies;

namespace Application.RelayProxies;

public class UpdateRelayProxy : IRequest<bool>
{
    public Guid Id { get; set; }

    public string Name { get; set; }

    public string Description { get; set; }

    public IEnumerable<RelayProxyScope> Scopes { get; set; }
    
    public IEnumerable<RelayProxyAgent> Agents { get; set; }
}

public class UpdateRelayProxyValidator : AbstractValidator<UpdateRelayProxy>
{
    public UpdateRelayProxyValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithErrorCode(ErrorCodes.NameIsRequired);

        RuleFor(x => x.Scopes)
            .Must(scopes =>
            {
                return scopes.Any() && 
                       scopes.All(scope => !string.IsNullOrWhiteSpace(scope.Id) && 
                                           !string.IsNullOrWhiteSpace(scope.ProjectId) && 
                                           scope.EnvIds.Any());   
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
        relayProxy.Update(request.Name, request.Description, request.Scopes, request.Agents);

        await _service.UpdateAsync(relayProxy);

        return true;
    }
}