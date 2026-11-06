using Api.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace Api.Public;

[Authorize]
[ApiController]
public abstract class ApiControllerBase : ControllerBase
{
    protected Guid EnvId
    {
        get
        {
            var value = User.FindFirstValue(SecretClaims.EnvId);
            return Guid.TryParse(value, out var envId) ? envId : Guid.Empty;
        }
    }
}