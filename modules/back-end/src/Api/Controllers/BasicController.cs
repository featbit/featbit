using Application.Users;

namespace Api.Controllers;

/// <summary>
/// These basic apis is intended for validating mvc basic setups (api versioning, consistent api response...)
/// </summary>
[ApiVersion(1.0)]
[ApiVersion(2.0)]
public class BasicController : ApiControllerBase
{
    [AllowAnonymous]
    [HttpGet("allow-anonymous")]
    public ApiResponse<bool> AllowAnonymous()
    {
        return Ok(true);
    }

    [HttpGet("authorized"), MapToApiVersion(1.0)]
    public ApiResponse<ICurrentUser> Authorized()
    {
        return Ok(CurrentUser);
    }

    /// <summary>
    /// Get v1 string
    /// </summary>
    /// <remarks>
    /// This is a http get method to get v1 string. Sample request:
    /// 
    ///     GET api/v1/basic/string
    /// 
    /// </remarks>
    /// <response code="200">Success</response>
    /// <response code="401">Unauthorized</response>
    [HttpGet("string"), MapToApiVersion(1.0)]
    public ApiResponse<string> GetStringV1()
    {
        return Ok("v1");
    }

    /// <summary>
    /// Get v2 string
    /// </summary>
    /// <remarks>
    /// Sample request:
    /// 
    ///     GET api/v2/basic/string
    /// 
    /// </remarks>
    /// <response code="200">Success</response>
    /// <response code="401">Unauthorized</response>
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