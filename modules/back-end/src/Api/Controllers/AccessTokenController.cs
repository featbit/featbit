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

        var accessToken = await Mediator.Send(request);
        return Ok(accessToken);
    }

    [HttpPut("{id:guid}/toggle")]
    public async Task<ApiResponse<bool>> ToggleAsync(Guid id)
    {
        var request = new ToggleAccessTokenStatus
        {
            Id = id
        };

        var success = await Mediator.Send(request);
        return Ok(success);
    }

    [HttpDelete("{id:guid}")]
    public async Task<ApiResponse<bool>> DeleteAsync(Guid id)
    {
        var request = new DeleteAccessToken
        {
            Id = id
        };

        var success = await Mediator.Send(request);
        return Ok(success);
    }

    [HttpPut("{id:guid}")]
    public async Task<ApiResponse<bool>> UpdateAsync(Guid id, UpdateAccessToken request)
    {
        request.Id = id;

        var accessTokenVm = await Mediator.Send(request);

        return Ok(accessTokenVm);
    }
}