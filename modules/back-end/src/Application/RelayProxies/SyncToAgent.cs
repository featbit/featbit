using Application.Bases;
using Application.Bases.Exceptions;

namespace Application.RelayProxies;

public class SyncToAgent: IRequest<SyncResultVm>
{
    public Guid OrgId { get; set; }
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
    private readonly IProjectService _projectService;
    private readonly IFeatureFlagService _featureFlagService;
    private readonly ISegmentService _segmentService;
    private readonly IAgentService _agentService;
    private readonly IMapper _mapper;

    public SyncToAgentHandler(
        IRelayProxyService service,
        IProjectService projectService,
        IFeatureFlagService featureFlagService,
        ISegmentService segmentService,
        IAgentService agentService,
        IMapper mapper)
    {
        _service = service;
        _projectService = projectService;
        _featureFlagService = featureFlagService;
        _segmentService = segmentService;
        _agentService = agentService;
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

        // fetch feature flags & segments
        IEnumerable<Guid> envIds;
        if (relayProxy.IsAllEnvs)
        {
            var projects = await _projectService.GetListAsync(request.OrgId);
            envIds = projects.SelectMany(x => x.Environments).Select(x => x.Id);
        }
        else
        {
            envIds = relayProxy.Scopes.SelectMany(x => x.EnvIds);
        }

        if (!envIds.Any())
        {
            return new SyncResultVm { SyncAt = agent.SyncAt };
        }

        var flags = await _featureFlagService.FindManyAsync(x => envIds.Contains(x.EnvId));
        var segments = await _segmentService.FindManyAsync(x => envIds.Contains(x.EnvId));

        var payload = new List<object>();
        foreach (var envId in envIds)
        {
            payload.Add(new
            {
                EnvId = envId,
                Flags = flags.Where(x => x.EnvId == envId),
                Segments = segments.Where(x => x.EnvId == envId)
            });
        }

        await _agentService.SyncAsync(agent.Host, relayProxy.Key, payload);
            
        // Save syncAt
        agent.Synced();
        await _service.UpdateAsync(relayProxy);
        
        return new SyncResultVm { SyncAt = agent.SyncAt };
    }
}