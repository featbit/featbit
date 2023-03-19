namespace Api.Controllers;

[ApiController]
[Route("api/v{version:apiVersion}/[controller]")]
public class OpenApiControllerBase : ControllerBase
{
}