using Domain.RelayProxies;
using Application.Bases.Exceptions;

namespace Application.RelayProxies;

public class GetAgentStatus : IRequest<AgentStatus>
{
    public Guid RelayProxyId { get; set; }

    public string AgentId { get; set; }
}

public class GetAgentStatusHandler : IRequestHandler<GetAgentStatus, AgentStatus>
{
    private readonly IRelayProxyService _relayProxyService;
    private readonly IAgentService _agentService;

    public GetAgentStatusHandler(IRelayProxyService relayProxyService, IAgentService agentService)
    {
        _relayProxyService = relayProxyService;
        _agentService = agentService;
    }

    public async Task<AgentStatus> Handle(GetAgentStatus request, CancellationToken cancellationToken)
    {
        var relayProxy = await _relayProxyService.GetAsync(request.RelayProxyId);

        var agent = relayProxy.Agents.FirstOrDefault(x => x.Id == request.AgentId);
        if (agent == null)
        {
            throw new BusinessException("Inconsistent relay proxy data");
        }

        var status = await _agentService.GetStatusAsync(agent.Host, relayProxy.Key);
        return status;
    }
}