using System.Net;
using Domain.RelayProxies;

namespace Application.RelayProxies;

public class GetAgentStatus : IRequest<AgentStatus>
{
    public Guid RelayProxyId { get; set; }

    public string Host { get; set; }
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

        try
        {
            var status = await _agentService.GetStatusAsync(request.Host, relayProxy.Key);
            return status;
        }
        catch (HttpRequestException ex)
        {
            return ex.StatusCode == HttpStatusCode.Unauthorized
                ? AgentStatus.Unauthorized()
                : AgentStatus.Unreachable();
        }
    }
}