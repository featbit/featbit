using Domain.Shared;
using Microsoft.AspNetCore.Mvc;

namespace Api.Public;

[ApiController]
[Route("api/public/[controller]")]
public class PublicApiControllerBase : ControllerBase
{
    protected Guid EnvId
    {
        get
        {
            string secretString = Request.Headers.Authorization;
            return Secret.TryParse(secretString, out var envId) ? envId : Guid.Empty;
        }
    }

    protected bool Authenticated => EnvId != Guid.Empty;
}