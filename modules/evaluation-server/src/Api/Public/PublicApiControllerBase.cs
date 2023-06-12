using Microsoft.AspNetCore.Mvc;
using Streaming.Shared;

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
            return Secret.TryParse(secretString, out var secret) ? secret.EnvId : Guid.Empty;
        }
    }

    protected bool Authenticated => EnvId != Guid.Empty;
}