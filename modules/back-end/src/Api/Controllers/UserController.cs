using Application.Users;

namespace Api.Controllers;

public class UserController : ApiControllerBase
{
    [HttpGet]
    [Route("profile")]
    public async Task<ApiResponse<Profile>> GetProfileAsync()
    {
        var request = new GetProfile { Id = CurrentUser.Id };
        
        var profile = await Mediator.Send(request);
        return Ok(profile);
    }
}