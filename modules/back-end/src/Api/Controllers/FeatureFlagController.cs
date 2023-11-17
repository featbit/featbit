using Newtonsoft.Json;
using System.Text.Json;
using Api.Authentication;
using Api.Authorization;
using Api.Swagger.Examples;
using Application.Bases.Models;
using Application.FeatureFlags;
using Domain.Workspaces;
using Domain.FeatureFlags;
using Microsoft.AspNetCore.JsonPatch;
using Microsoft.AspNetCore.JsonPatch.Operations;
using Swashbuckle.AspNetCore.Filters;

namespace Api.Controllers;

[Authorize(Permissions.ManageFeatureFlag)]
[Route("api/v{version:apiVersion}/envs/{envId:guid}/feature-flags")]
public class FeatureFlagController : ApiControllerBase
{
    /// <summary>
    /// Get flag list of an environment
    /// </summary>
    /// <remarks>
    /// Get the list of flags of a particular environment.
    /// </remarks>
    [OpenApi]
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

    /// <summary>
    /// Get a feature flag
    /// </summary>
    /// <remarks>
    /// Get a single feature flag by key.
    /// </remarks>
    [OpenApi]
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

    /// <summary>
    /// Create a feature flag
    /// </summary>
    /// <remarks>
    /// Create a feature flag with the given name, key, and description.
    /// </remarks>
    [OpenApi]
    [HttpPost]
    public async Task<ApiResponse<FeatureFlag>> CreateAsync(Guid envId, CreateFeatureFlag request)
    {
        request.EnvId = envId;

        var flag = await Mediator.Send(request);
        return Ok(flag);
    }

    /// <summary>
    /// Archive a feature flag
    /// </summary>
    [OpenApi]
    [HttpPut("{key}/archive")]
    public async Task<ApiResponse<bool>> ArchiveAsync(Guid envId, string key)
    {
        var request = new ArchiveFeatureFlag
        {
            EnvId = envId,
            Key = key
        };

        var success = await Mediator.Send(request);
        return Ok(success);
    }

    /// <summary>
    /// Restore a feature flag
    /// </summary>
    [OpenApi]
    [HttpPut("{key}/restore")]
    public async Task<ApiResponse<bool>> RestoreAsync(Guid envId, string key)
    {
        var request = new RestoreFeatureFlag
        {
            EnvId = envId,
            Key = key
        };

        var success = await Mediator.Send(request);
        return Ok(success);
    }

    /// <summary>
    /// Delete a feature flag
    /// </summary>
    [OpenApi]
    [HttpDelete("{key}")]
    public async Task<ApiResponse<bool>> DeleteAsync(Guid envId, string key)
    {
        var request = new DeleteFeatureFlag
        {
            EnvId = envId,
            Key = key
        };

        var success = await Mediator.Send(request);
        return Ok(success);
    }

    [HttpPut("{key}/toggle")]
    public async Task<ApiResponse<bool>> ToggleAsync(Guid envId, string key)
    {
        var request = new ToggleFeatureFlag
        {
            EnvId = envId,
            Key = key
        };

        var success = await Mediator.Send(request);
        return Ok(success);
    }

    [HttpPut("{key}/settings")]
    public async Task<ApiResponse<bool>> UpdateSettingAsync(Guid envId, string key, UpdateSetting request)
    {
        request.Key = key;
        request.EnvId = envId;

        var success = await Mediator.Send(request);
        return Ok(success);
    }

    /// <summary>
    /// Update a feature flag with the JSON patch method
    /// </summary>
    /// <remarks>
    /// Perform a partial update to a feature flag. The request body must be a valid JSON patch.
    /// </remarks>
    [OpenApi]
    [SwaggerRequestExample(typeof(Operation), typeof(PatchFeatureFlagExamples))]
    [HttpPatch("{key}")]
    public async Task<ApiResponse<bool>> PatchAsync(Guid envId, string key, [FromBody] JsonElement jsonElement)
    {
        var patch = JsonConvert.DeserializeObject<JsonPatchDocument>(jsonElement.GetRawText());
        var request = new PatchFeatureFlag
        {
            EnvId = envId,
            Key = key,
            Patch = patch
        };

        var result = await Mediator.Send(request);
        return result.Success ? Ok(true) : Error<bool>(result.Message);
    }

    [HttpPut("{key}/variations")]
    public async Task<ApiResponse<bool>> UpdateVariationsAsync(Guid envId, string key, UpdateVariations request)
    {
        request.Key = key;
        request.EnvId = envId;

        var success = await Mediator.Send(request);
        return Ok(success);
    }

    /// <summary>
    /// Get the list of pending changes of a flag
    /// </summary>
    /// <remarks>
    /// Get the list of pending changes of a particular flag
    /// </remarks>
    [HttpGet("{key}/pending-changes")]
    public async Task<ApiResponse<IEnumerable<PendingChangesVm>>> GetPendingChangesAsync(Guid envId, string key)
    {
        var request = new GetPendingChanges
        {
            EnvId = envId,
            Key = key
        };

        var pendingChanges = await Mediator.Send(request);
        return Ok(pendingChanges);
    }

    [Authorize(LicenseFeatures.Schedule)]
    [HttpPost("{key}/schedules")]
    public async Task<ApiResponse<bool>> CreateScheduleAsync(Guid envId, string key, CreateFlagSchedule request)
    {
        request.WorkspaceId = WorkspaceId;
        request.OrgId = OrgId;
        request.Key = key;
        request.EnvId = envId;

        var success = await Mediator.Send(request);
        return Ok(success);
    }

    /// <summary>
    /// Delete a flag schedule
    /// </summary>
    [Authorize(LicenseFeatures.Schedule)]
    [HttpDelete("schedules/{id:guid}")]
    public async Task<ApiResponse<bool>> DeleteScheduleAsync(Guid id)
    {
        var request = new DeleteFlagSchedule
        {
            Id = id
        };

        var success = await Mediator.Send(request);
        return Ok(success);
    }

    [Authorize(LicenseFeatures.ChangeRequest)]
    [HttpPost("{key}/change-requests")]
    public async Task<ApiResponse<bool>> CreateChangeRequestAsync(Guid envId, string key, CreateFlagChangeRequest request)
    {
        request.OrgId = OrgId;
        request.Key = key;
        request.EnvId = envId;

        var success = await Mediator.Send(request);
        return Ok(success);
    }

    [Authorize(LicenseFeatures.ChangeRequest)]
    [HttpPut("change-requests/{id:guid}/approve")]
    public async Task<ApiResponse<bool>> ApproveChangeRequestAsync(Guid envId, Guid id)
    {
        var request = new ApproveFlagChangeRequest
        {
            OrgId = OrgId,
            EnvId = envId,
            Id = id
        };

        var success = await Mediator.Send(request);
        return Ok(success);
    }

    [Authorize(LicenseFeatures.ChangeRequest)]
    [HttpPut("change-requests/{id:guid}/decline")]
    public async Task<ApiResponse<bool>> DeclineChangeRequestAsync(Guid envId, Guid id)
    {
        var request = new DeclineFlagChangeRequest
        {
            OrgId = OrgId,
            EnvId = envId,
            Id = id
        };

        var success = await Mediator.Send(request);
        return Ok(success);
    }

    [Authorize(LicenseFeatures.ChangeRequest)]
    [HttpPut("change-requests/{id:guid}/apply")]
    public async Task<ApiResponse<bool>> ApplyChangeRequestAsync(Guid envId, Guid id)
    {
        var request = new ApplyFlagChangeRequest
        {
            OrgId = OrgId,
            EnvId = envId,
            Id = id
        };

        var success = await Mediator.Send(request);
        return Ok(success);
    }

    /// <summary>
    /// Delete a flag change request
    /// </summary>
    [Authorize(LicenseFeatures.ChangeRequest)]
    [HttpDelete("change-requests/{id:guid}")]
    public async Task<ApiResponse<bool>> DeleteChangeRequestAsync(Guid id)
    {
        var request = new DeleteFlagChangeRequest
        {
            Id = id
        };

        var success = await Mediator.Send(request);
        return Ok(success);
    }

    [HttpPut("{key}/targeting")]
    public async Task<ApiResponse<bool>> UpdateTargetingAsync(Guid envId, string key, UpdateTargeting request)
    {
        request.OrgId = OrgId;
        request.Key = key;
        request.EnvId = envId;

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

    [HttpPut("{key}/tags")]
    public async Task<ApiResponse<bool>> SetTagsAsync(Guid envId, string key, ICollection<string> tags)
    {
        var request = new SetTags
        {
            EnvId = envId,
            Key = key,
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