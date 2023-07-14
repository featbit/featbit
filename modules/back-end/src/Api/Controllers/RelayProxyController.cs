using Domain.RelayProxies;
using Application.Bases.Models;
using Application.RelayProxies;

namespace Api.Controllers;

[Route("api/v{version:apiVersion}/relay-proxies")]
public class RelayProxyController : ApiControllerBase
{
    [HttpGet]
    public async Task<ApiResponse<PagedResult<RelayProxy>>> GetListAsync([FromQuery] RelayProxyFilter filter)
    {
        var request = new GetRelayProxyList
        {
            OrganizationId = OrgId,
            Filter = filter
        };

        var relayProxies = await Mediator.Send(request);
        return Ok(relayProxies);
    }

    [HttpPost]
    public async Task<ApiResponse<RelayProxy>> CreateAsync(CreateRelayProxy request)
    {
        request.OrganizationId = OrgId;

        var relayProxy = await Mediator.Send(request);
        return Ok(relayProxy);
    }

    [HttpPut("{id:guid}")]
    public async Task<ApiResponse<bool>> UpdateAsync(Guid id, UpdateRelayProxy request)
    {
        request.Id = id;

        var updated = await Mediator.Send(request);
        return Ok(updated);
    }

    [HttpGet("is-name-used")]
    public async Task<ApiResponse<bool>> IsNameUsedAsync(string name)
    {
        var request = new IsRelayProxyNameUsed
        {
            OrganizationId = OrgId,
            Name = name
        };

        var isNameUsed = await Mediator.Send(request);
        return Ok(isNameUsed);
    }

    [HttpDelete("{id:guid}")]
    public async Task<ApiResponse<bool>> DeleteAsync(Guid id)
    {
        var request = new DeleteRelayProxy
        {
            Id = id
        };

        var success = await Mediator.Send(request);
        return Ok(success);
    }

    [HttpGet("{relayProxyId:guid}/agent-status")]
    public async Task<ApiResponse<AgentStatus>> GetAgentStatusAsync(Guid relayProxyId, string host)
    {
        var request = new GetAgentStatus
        {
            RelayProxyId = relayProxyId,
            Host = host
        };

        var status = await Mediator.Send(request);
        return Ok(status);
    }

    [HttpPut("{relayProxyId:guid}/agents/{agentId}/sync")]
    public async Task<ApiResponse<SyncResult>> SyncToAgentAsync(Guid relayProxyId, string agentId)
    {
        var request = new SyncToAgent
        {
            RelayProxyId = relayProxyId,
            AgentId = agentId
        };

        var syncResult = await Mediator.Send(request);
        return Ok(syncResult);
    }
}