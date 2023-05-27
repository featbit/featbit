using System.Text.RegularExpressions;
using Application.AccessTokens;
using Application.Bases;
using Application.Bases.Exceptions;
using Application.Users;
using Domain.AccessTokens;
using Domain.RelayProxies;

namespace Application.RelayProxies;

public class CreateRelayProxy : IRequest<RelayProxyVm>
{
    public Guid OrganizationId { get; set; }
    
    public string Name { get; set; }

    public string Description { get; set; }

    public IEnumerable<RelayProxyScope> Scopes { get; set; }
    
    public IEnumerable<RelayProxyAgent> Agents { get; set; }
}

public class CreateAccessTokenValidator : AbstractValidator<CreateRelayProxy>
{
    public CreateAccessTokenValidator()
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

public class CreateRelayProxyHandler : IRequestHandler<CreateRelayProxy, RelayProxyVm>
{
    private readonly IRelayProxyService _service;
    private readonly IMapper _mapper;

    public CreateRelayProxyHandler(
        IRelayProxyService service,
        IMapper mapper)
    {
        _service = service;
        _mapper = mapper;
    }

    public async Task<RelayProxyVm> Handle(CreateRelayProxy request, CancellationToken cancellationToken)
    {
        var existed =
            await _service.FindOneAsync(rp => string.Equals(rp.Name, request.Name, StringComparison.OrdinalIgnoreCase));
        
        if (existed != null)
        {
            throw new BusinessException(ErrorCodes.EntityExistsAlready);
        }

        var relayProxy =
            new RelayProxy(request.OrganizationId, request.Name, request.Description, request.Scopes, request.Agents);

        await _service.AddOneAsync(relayProxy);

        return _mapper.Map<RelayProxyVm>(relayProxy);
    }
}