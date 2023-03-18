using Application.Bases.Models;
using Application.FeatureFlags;
using Domain.FeatureFlags;

namespace Api.Controllers;

[Route("api/v{version:apiVersion}/envs/{envId:guid}/feature-flags")]
public class FeatureFlagController : ApiControllerBase
{
    [HttpGet]
    //[PermissionActionFilter([Domain.Resources.ResourceType.FeatureFlag], "creation")]
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

    [HttpGet("is-key-used")]
    public async Task<ApiResponse<bool>> IsKeyUsedAsync(Guid envId, string key)
    {
        var request = new IsFeatureFlagKeyUsed
        {
            EnvId = envId,
            Key = key
        };

        var isUsed = await Mediator.Send(request);
        return Ok(isUsed);
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

    [HttpPut("{id:guid}/restore")]
    public async Task<ApiResponse<bool>> RestoreAsync(Guid id)
    {
        var request = new RestoreFeatureFlag
        {
            Id = id
        };

        var success = await Mediator.Send(request);
        return Ok(success);
    }

    [HttpDelete("{id:guid}")]
    public async Task<ApiResponse<bool>> DeleteAsync(Guid envId, Guid id)
    {
        var request = new DeleteFeatureFlag
        {
            EnvId = envId,
            Id = id
        };

        var success = await Mediator.Send(request);
        return Ok(success);
    }

    [HttpPut("{id:guid}/toggle")]
    public async Task<ApiResponse<bool>> ToggleAsync(Guid id)
    {
        var request = new ToggleFeatureFlag
        {
            Id = id
        };

        var success = await Mediator.Send(request);
        return Ok(success);
    }

    [HttpPut("{id:guid}/settings")]
    public async Task<ApiResponse<bool>> UpdateSettingAsync(Guid id, UpdateSetting request)
    {
        request.Id = id;

        var success = await Mediator.Send(request);
        return Ok(success);
    }

    [HttpPut("{id:guid}/variations")]
    public async Task<ApiResponse<bool>> UpdateVariationsAsync(Guid id, UpdateVariations request)
    {
        request.Id = id;

        var success = await Mediator.Send(request);
        return Ok(success);
    }

    [HttpPut("{id:guid}/targeting")]
    public async Task<ApiResponse<bool>> UpdateTargetingAsync(Guid id, UpdateTargeting request)
    {
        request.Id = id;

        var success = await Mediator.Send(request);
        return Ok(success);
    }

    [HttpPost("copy-to-env/{targetEnvId:guid}")]
    public async Task<ApiResponse<CopyToEnvResult>> CopyToEnvAsync(
        Guid targetEnvId,
        [FromBody] ICollection<Guid> flagIds)
    {
        var request = new CopyToEnv
        {
            TargetEnvId = targetEnvId,
            FlagIds = flagIds
        };

        var copyToEnvResult = await Mediator.Send(request);
        return Ok(copyToEnvResult);
    }

    [HttpGet("all-tags")]
    public async Task<ApiResponse<ICollection<string>>> GetAllTagsAsync(Guid envId)
    {
        var request = new GetAllTag
        {
            EnvId = envId
        };

        var tags = await Mediator.Send(request);
        return Ok(tags);
    }

    [HttpPut("{id:guid}/tags")]
    public async Task<ApiResponse<bool>> SetTagsAsync(Guid id, ICollection<string> tags)
    {
        var request = new SetTags
        {
            Id = id,
            Tags = tags
        };

        var success = await Mediator.Send(request);
        return Ok(success);
    }

    [HttpGet]
    [Route("insights")]
    public async Task<ApiResponse<IEnumerable<InsightsVm>>> GetStatsByVariationAsync(
        Guid envId,
        [FromQuery] StatsByVariationFilter filter)
    {
        var request = new GetInsights
        {
            EnvId = envId,
            Filter = filter
        };

        var stats = await Mediator.Send(request);
        return Ok(stats);
    }
}