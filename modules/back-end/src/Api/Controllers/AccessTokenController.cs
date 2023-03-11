using Application.AccessTokens;
using Application.Bases.Models;

namespace Api.Controllers;

[Route("api/v{version:apiVersion}/organizations/{organizationId:guid}/access-tokens")]
public class AccessTokenController : ApiControllerBase
{
    [HttpGet]
    public async Task<ApiResponse<PagedResult<AccessTokenVm>>> GetListAsync(
        Guid organizationId,
        [FromQuery] AccessTokenFilter filter)
    {
        var request = new GetAccessTokenList
        {
            OrganizationId = organizationId,
            Filter = filter
        };
    
        var accessTokens = await Mediator.Send(request);
        return Ok(accessTokens);
    }
    
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
    
    [HttpPost]
    public async Task<ApiResponse<AccessTokenVm>> CreateAsync(Guid organizationId, CreateAccessToken request)
    {
        request.OrganizationId = organizationId;
        request.CreatorId = CurrentUser.Id;

        var accessToken = await Mediator.Send(request);
        return Ok(accessToken);
    }
}