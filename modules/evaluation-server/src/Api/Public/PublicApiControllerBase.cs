using Api.Authentication;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace Api.Public;

[ApiController]
[Route("api/public/[controller]")]
public class PublicApiControllerBase : ControllerBase
{
    protected Guid EnvId
    {
        get
        {
            var value = User.FindFirstValue(FeatBitClaims.EnvId);
            return Guid.TryParse(value, out var envId) ? envId : Guid.Empty;
        }
    }
}