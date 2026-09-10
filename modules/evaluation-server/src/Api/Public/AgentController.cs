using Api.RateLimiting;
using Domain.Observability;
using Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace Api.Public;

[AllowAnonymous]
[EnableRateLimiting(RateLimitingPolicies.Agent)]
public class AgentController(IRelayProxyAppService rpService, ILogger<AgentController> logger) : PublicApiControllerBase
{
    [HttpPost]
    [Route("register")]
    public async Task<IActionResult> RegisterAsync([FromBody] string agentId)
    {
        var key = Request.Headers.Authorization.ToString();
        var metrics = AgentMetrics.Current;

        var workspace = await rpService.GetWorkspaceAsync(key);
        if (workspace is null)
        {
            metrics.RecordRegistration(Outcomes.Rejected, AgentReasons.Unauthorized);
            return Unauthorized();
        }

        var isQuotaAllowed = await rpService.CheckQuotaAsync(workspace);
        if (!isQuotaAllowed)
        {
            // Working as designed rather than broken, and silent everywhere else: nothing throws,
            // so no error log and no exception metric records this.
            metrics.RecordRegistration(Outcomes.Rejected, AgentReasons.QuotaExceeded);
            return StatusCode(403);
        }

        try
        {
            await rpService.RegisterAgentAsync(key, agentId);

            metrics.RecordRegistration(Outcomes.Success, AgentReasons.Registered);
            return Ok(agentId);
        }
        catch (Exception ex)
        {
            metrics.RecordRegistration(Outcomes.Failure, AgentReasons.Error);

            logger.LogError(ex, "Exception occurred while registering agent.");
            return StatusCode(500);
        }
    }
}
