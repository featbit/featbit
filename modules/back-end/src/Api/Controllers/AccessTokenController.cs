using Application.AccessTokens;

namespace Api.Controllers;

[Route("api/v{version:apiVersion}/organizations/{organizationId:guid}/access-tokens")]
public class AccessTokenController : ApiControllerBase
{
    [HttpGet("is-name-used")]
    public async Task<ApiResponse<bool>> IsNameUsedAsync(Guid organizationId, string name)
    {
        var request = new IsAccessTokenNameUsed
        {
            OrganizationId = organizationId,
            Name = name
        };

        var isNameUsed = await Mediator.Send(request);
        return Ok(isNameUsed);
    }
}