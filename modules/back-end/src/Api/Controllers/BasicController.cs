namespace Api.Controllers;

/// <summary>
/// this controller is intended for testing mvc basic setups (api versioning, consistent api response...)
/// </summary>
[ApiVersion(1.0)]
[ApiVersion(2.0)]
public class BasicController : ApiControllerBase
{
    [HttpGet("string"), MapToApiVersion(1.0)]
    public string GetStringV1()
    {
        return "v1";
    }

    [HttpGet("string"), MapToApiVersion(2.0)]
    public string GetStringV2()
    {
        return "v2";
    }
}