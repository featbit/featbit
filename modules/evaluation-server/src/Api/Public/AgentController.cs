using Domain.Shared;
using Microsoft.AspNetCore.Mvc;

namespace Api.Public;

public class AgentController(IDbStore store) : PublicApiControllerBase
{
    [HttpGet("relay-proxy/get-envs")]
    public async Task<IActionResult> GetRelayProxyEnvsAsync()
    {
        if (RelayProxyKey == string.Empty)
        {
            return Unauthorized();
        }

        var secrets = await store.GetSecretsFromRelayProxyKey(RelayProxyKey);
        
        return new JsonResult(secrets);
    }
}