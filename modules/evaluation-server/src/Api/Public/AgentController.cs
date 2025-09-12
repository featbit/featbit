using Infrastructure.Services;
using Microsoft.AspNetCore.Mvc;

namespace Api.Public;

public class AgentController(IRelayProxyAppService rpService, ILogger<AgentController> logger) : PublicApiControllerBase
{
    [HttpPost]
    [Route("register")]
    public async Task<IActionResult> RegisterAsync([FromBody] string agentId)
    {
        var key = Request.Headers.Authorization.ToString();

        var workspace = await rpService.GetWorkspaceAsync(key);
        if (workspace is null)
        {
            return Unauthorized();
        }

        var isQuotaAllowed = await rpService.CheckQuotaAsync(workspace);
        if (!isQuotaAllowed)
        {
            return StatusCode(403);
        }

        try
        {
            await rpService.RegisterAgentAsync(key, agentId);
            return Ok(agentId);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Exception occurred while registering agent.");
            return StatusCode(500);
        }
    }
}