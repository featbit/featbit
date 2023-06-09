using Application.Bases;
using Application.Bases.Exceptions;
using Microsoft.Extensions.DependencyInjection.RelayProxies;

namespace Application.RelayProxies;

public class GetAgentStatus: IRequest<ProxyAgentStatusVm>
{
    public Guid RelayProxyId { get; set; }
    
    public string Host { get; set; }
}

public class GetAgentStatusValidator : AbstractValidator<GetAgentStatus>
{
    public GetAgentStatusValidator()
    {
        RuleFor(x => x.Host)
            .NotEmpty().WithErrorCode(ErrorCodes.RelayProxyAgentHostIsRequired);

        RuleFor(x => x.RelayProxyId)
            .NotEmpty().WithErrorCode(ErrorCodes.RelayProxyIdIsRequired);
    }
}

public class GetAgentStatusHandler : IRequestHandler<GetAgentStatus, ProxyAgentStatusVm>
{
    private readonly IRelayProxyService _service;
    private readonly IAgentService _agentService;
    private readonly IMapper _mapper;

    public GetAgentStatusHandler(
        IRelayProxyService service,
        IAgentService agentService,
        IMapper mapper)
    {
        _service = service;
        _agentService = agentService;
        _mapper = mapper;
    }

    public async Task<ProxyAgentStatusVm> Handle(GetAgentStatus request, CancellationToken cancellationToken)
    {
        var relayProxy = await _service.GetAsync(request.RelayProxyId);
        
        if (relayProxy == null)
        {
            throw new BusinessException(ErrorCodes.EntityNotExists);
        }
        
        var status = await _agentService.GetStatusAsync(request.Host, relayProxy.Key);

        return _mapper.Map<ProxyAgentStatusVm>(status);
    }
}