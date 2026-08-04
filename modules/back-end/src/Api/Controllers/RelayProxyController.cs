using System.Net;
using Domain.RelayProxies;
using Application.Bases.Models;
using Application.RelayProxies;
using Domain.Policies;

namespace Api.Controllers;

[Route("api/v{version:apiVersion}/relay-proxies")]
public class RelayProxyController : ApiControllerBase
{
    [HttpGet]
    [Authorize(Permissions.ListRelayProxies)]
    public async Task<ApiResponse<PagedResult<RelayProxyVm>>> GetListAsync([FromQuery] RelayProxyFilter filter)
    {
        var request = new GetRelayProxyList
        {
            OrganizationId = OrgId,
            Filter = filter
        };

        var rpVms = await Mediator.Send(request);
        return Ok(rpVms);
    }

    [HttpPost]
    [Authorize(Permissions.ManageRelayProxies)]
    public async Task<ApiResponse<RelayProxy>> CreateAsync(CreateRelayProxy request)
    {
        request.OrganizationId = OrgId;

        var relayProxy = await Mediator.Send(request);
        return Ok(relayProxy);
    }

    [HttpPut("{id:guid}")]
    [Authorize(Permissions.ManageRelayProxies)]
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
    [Authorize(Permissions.ManageRelayProxies)]
    public async Task<ApiResponse<bool>> DeleteAsync(Guid id)
    {
        var request = new DeleteRelayProxy
        {
            Id = id
        };

        var success = await Mediator.Send(request);
        return Ok(success);
    }

    [HttpGet("agent-availability")]
    [Authorize(Permissions.ManageRelayProxies)]
    public async Task<ApiResponse<HttpStatusCode>> CheckAgentAvailabilityAsync(string agentHost)
    {
        var request = new CheckAgentAvailability
        {
            Host = agentHost
        };

        var statusCode = await Mediator.Send(request);
        return Ok(statusCode);
    }

    [HttpPut("{rpId:guid}/agents/{agentId}/sync")]
    [Authorize(Permissions.ManageRelayProxies)]
    public async Task<ApiResponse<SyncResult>> SyncToAgentAsync(Guid rpId, string agentId, string host)
    {
        var request = new SyncToAgent
        {
            WorkspaceId = WorkspaceId,
            RelayProxyId = rpId,
            AgentId = agentId,
            Host = host
        };

        var syncResult = await Mediator.Send(request);
        return Ok(syncResult);
    }
}
