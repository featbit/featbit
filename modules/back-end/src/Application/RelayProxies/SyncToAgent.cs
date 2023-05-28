using Application.Bases;
using Application.Bases.Exceptions;

namespace Application.RelayProxies;

public class SyncToAgent: IRequest<SyncResultVm>
{
    public Guid RelayProxyId { get; set; }
    
    public string AgentId { get; set; }
    
}

public class SyncToAgentValidator : AbstractValidator<SyncToAgent>
{
    public SyncToAgentValidator()
    {
        RuleFor(x => x.RelayProxyId)
            .NotEmpty().WithErrorCode(ErrorCodes.RelayProxyIdIsRequired);

        RuleFor(x => x.AgentId)
            .NotEmpty().WithErrorCode(ErrorCodes.AgentIdIsRequired);
    }
}

public class SyncToAgentHandler : IRequestHandler<SyncToAgent, SyncResultVm>
{
    private readonly IRelayProxyService _service;
    private readonly IMapper _mapper;

    public SyncToAgentHandler(
        IRelayProxyService service,
        IMapper mapper)
    {
        _service = service;
        _mapper = mapper;
    }

    public async Task<SyncResultVm> Handle(SyncToAgent request, CancellationToken cancellationToken)
    {
        var relayProxy = await _service.GetAsync(request.RelayProxyId);
        
        if (relayProxy == null)
        {
            throw new BusinessException(ErrorCodes.EntityNotExists);
        }
        
        var agent = relayProxy.Agents.FirstOrDefault(agent => agent.Id == request.AgentId);
        if (agent == null)
        {
            throw new BusinessException(ErrorCodes.EntityNotExists);
        }

        // TODO sync
        
       
        // Save syncAt
        agent.SyncAt = DateTime.UtcNow;
        
        await _service.UpdateAsync(relayProxy);

        return new SyncResultVm { SyncAt = agent.SyncAt.Value };
    }
}