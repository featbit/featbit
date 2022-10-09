using Application.Bases.Models;
using Application.FeatureFlags;
using Domain.FeatureFlags;

namespace Api.Controllers;

[Route("api/v{version:apiVersion}/envs/{envId:guid}/feature-flags")]
public class FeatureFlagController : ApiControllerBase
{
    [HttpGet]
    public async Task<ApiResponse<PagedResult<FeatureFlagVm>>> GetListAsync(
        Guid envId,
        [FromQuery] FeatureFlagFilter filter)
    {
        var request = new GetFeatureFlagList
        {
            EnvId = envId,
            Filter = filter
        };

        var flags = await Mediator.Send(request);
        return Ok(flags);
    }

    [HttpGet("{key}")]
    public async Task<ApiResponse<FeatureFlag>> GetAsync(Guid envId, string key)
    {
        var request = new GetFeatureFlag
        {
            EnvId = envId,
            Key = key
        };

        var flag = await Mediator.Send(request);
        return Ok(flag);
    }

    [HttpPost]
    public async Task<ApiResponse<FeatureFlag>> CreateAsync(Guid envId, CreateFeatureFlag request)
    {
        request.EnvId = envId;

        var flag = await Mediator.Send(request);
        return Ok(flag);
    }

    [HttpPut("{id:guid}/archive")]
    public async Task<ApiResponse<bool>> ArchiveAsync(Guid id)
    {
        var request = new ArchiveFeatureFlag
        {
            Id = id
        };

        var success = await Mediator.Send(request);
        return Ok(success);
    }
}