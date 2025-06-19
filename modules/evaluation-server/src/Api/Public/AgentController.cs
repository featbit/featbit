using Microsoft.AspNetCore.Mvc;
using Streaming.Services;

namespace Api.Public;

public class AgentController(IRelayProxyService rpService, ILogger<AgentController> logger) : PublicApiControllerBase
{
    [HttpPost]
    [Route("register")]
    public async Task<IActionResult> RegisterAsync()
    {
        var key = Request.Headers.Authorization.ToString();

        var isKeyValid = await rpService.IsKeyValidAsync(key);
        if (!isKeyValid)
        {
            return Unauthorized();
        }

        try
        {
            var agentId = await rpService.RegisterAgentAsync(key);
            return Ok(agentId);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Exception occurred while registering agent.");
            return StatusCode(500);
        }
    }
}