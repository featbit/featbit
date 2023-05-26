using Application.AccessTokens;
using Application.Bases.Models;
using Application.RelayProxies;
using Microsoft.Extensions.DependencyInjection.RelayProxies;

namespace Api.Controllers;


[Route("api/v{version:apiVersion}/relay-proxies")]
public class RelayProxyController : ApiControllerBase
{
    [HttpGet]
    public async Task<ApiResponse<PagedResult<RelayProxyVm>>> GetListAsync([FromQuery] RelayProxyFilter filter)
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
    public async Task<ApiResponse<RelayProxyVm>> CreateAsync(CreateRelayProxy request)
    {
        request.OrganizationId = OrgId;

        var accessToken = await Mediator.Send(request);
        return Ok(accessToken);
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
    
    [HttpGet("agent-status")]
    public async Task<ApiResponse<AgentStatusVm>> GetAgentStatusAsync([FromQuery] string host)
    {
        var status = new AgentStatusVm
        {
            Name = host,
            Sex = "blue",
            Hello = "world"
        };
        
        return Ok(status);
    }
}