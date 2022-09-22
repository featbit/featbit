namespace Api.Controllers;

/// <summary>
/// this controller is intended for testing mvc basic setups (api versioning, consistent api response...)
/// </summary>
[ApiVersion(1.0)]
[ApiVersion(2.0)]
public class BasicController : ApiControllerBase
{
    [HttpGet("string"), MapToApiVersion(1.0)]
    public ApiResponse<string> GetStringV1()
    {
        return Ok("v1");
    }

    [HttpGet("string"), MapToApiVersion(2.0)]
    public ApiResponse<string> GetStringV2()
    {
        return Ok("v2");
    }

    [HttpGet("exception")]
    public ApiResponse<string> ThrowException()
    {
        throw new Exception("exception message");
    }
}