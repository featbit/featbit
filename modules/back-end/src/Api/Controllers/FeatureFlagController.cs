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
    [Authorize(Permissions.CreateFlag)]
    public async Task<ApiResponse<FeatureFlag>> CreateAsync(Guid envId, CreateFeatureFlag request)
    {
        request.EnvId = envId;

        var flag = await Mediator.Send(request);
        return Ok(flag);
    }

    /// <summary>
    /// Archive a feature flag
    /// </summary>
    /// <remarks>
    /// Archive a feature flag with the specified key. Archived flags are hidden from the main list by default
    /// but can be restored later.
    /// </remarks>
    [OpenApi]
    [HttpPut("{key}/archive")]
    [Authorize(Permissions.ArchiveFlag)]
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
    /// <remarks>
    /// Restore an archived feature flag with the specified key, making it visible and usable again.
    /// </remarks>
    [OpenApi]
    [HttpPut("{key}/restore")]
    [Authorize(Permissions.RestoreFlag)]
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
    /// <remarks>
    /// Permanently delete a feature flag with the specified key. This action cannot be undone.
    /// </remarks>
    [OpenApi]
    [HttpDelete("{key}")]
    [Authorize(Permissions.DeleteFlag)]
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

    /// <summary>
    /// Toggle a feature flag on or off
    /// </summary>
    /// <remarks>
    /// Enable or disable a feature flag.
    /// </remarks>
    [OpenApi]
    [HttpPut("{key}/toggle/{status}")]
    [Authorize(Permissions.ToggleFlag)]
    public async Task<ApiResponse<Guid>> ToggleAsync(Guid envId, string key, bool status)
    {
        var request = new ToggleFeatureFlag
        {
            EnvId = envId,
            Key = key,
            Status = status
        };

        var revision = await Mediator.Send(request);
        return Ok(revision);
    }

    /// <summary>
    /// Update the name of a feature flag
    /// </summary>
    /// <remarks>
    /// Update the display name of an existing feature flag.
    /// </remarks>
    [OpenApi]
    [HttpPut("{key}/name")]
    [Authorize(Permissions.UpdateFlagName)]
    public async Task<ApiResponse<Guid>> UpdateNameAsync(Guid envId, string key, UpdateName request)
    {
        request.Key = key;
        request.EnvId = envId;

        var revision = await Mediator.Send(request);
        return Ok(revision);
    }

    /// <summary>
    /// Update the description of a feature flag
    /// </summary>
    /// <remarks>
    /// Update the description field of a feature flag to provide additional context and documentation.
    /// </remarks>
    [OpenApi]
    [HttpPut("{key}/description")]
    [Authorize(Permissions.UpdateFlagDescription)]
    public async Task<ApiResponse<Guid>> UpdateDescriptionAsync(Guid envId, string key, UpdateDescription request)
    {
        request.Key = key;
        request.EnvId = envId;

        var revision = await Mediator.Send(request);
        return Ok(revision);
    }

    /// <summary>
    /// Update the off variation of a feature flag
    /// </summary>
    /// <remarks>
    /// Set which variation should be served when the feature flag is disabled (off).
    /// </remarks>
    [OpenApi]
    [HttpPut("{key}/off-variation")]
    [Authorize(Permissions.UpdateFlagOffVariation)]
    public async Task<ApiResponse<Guid>> UpdateOffVariationAsync(Guid envId, string key, UpdateOffVariation request)
    {
        request.Key = key;
        request.EnvId = envId;

        var revision = await Mediator.Send(request);
        return Ok(revision);
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

    /// <summary>
    /// Update the variations of a feature flag
    /// </summary>
    /// <remarks>
    /// Update the list of possible variations (different return values) for a feature flag.
    /// </remarks>
    [OpenApi]
    [HttpPut("{key}/variations")]
    [Authorize(Permissions.UpdateFlagVariations)]
    public async Task<ApiResponse<Guid>> UpdateVariationsAsync(Guid envId, string key, UpdateVariations request)
    {
        request.Key = key;
        request.EnvId = envId;

        var revision = await Mediator.Send(request);
        return Ok(revision);
    }

    /// <summary>
    /// Get the list of pending changes of a flag
    /// </summary>
    /// <remarks>
    /// Get the list of pending changes of a particular flag
    /// </remarks>
    [OpenApi]
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
    public async Task<ApiResponse<Guid>> UpdateTargetingAsync(Guid envId, string key, UpdateTargeting request)
    {
        request.OrgId = OrgId;
        request.Key = key;
        request.EnvId = envId;

        var revision = await Mediator.Send(request);
        return Ok(revision);
    }

    [HttpPost("copy-to-env-precheck/{targetEnvId:guid}")]
    public async Task<ApiResponse<ICollection<CopyToEnvPrecheckResult>>> CopyToEnvPrecheckAsync(
        Guid targetEnvId,
        [FromBody] ICollection<Guid> flagIds)
    {
        var request = new CopyToEnvPrecheck
        {
            TargetEnvId = targetEnvId,
            FlagIds = flagIds
        };

        var results = await Mediator.Send(request);
        return Ok(results);
    }

    [HttpPost("copy-to-env/{targetEnvId:guid}")]
    public async Task<ApiResponse<CopyToEnvResult>> CopyToEnvAsync(Guid envId, Guid targetEnvId, CopyToEnv request)
    {
        request.SourceEnvId = envId;
        request.TargetEnvId = targetEnvId;

        var copyToEnvResult = await Mediator.Send(request);
        return Ok(copyToEnvResult);
    }

    /// <summary>
    /// Clone a feature flag
    /// </summary>
    /// <remarks>
    /// Create a new feature flag by cloning an existing one with all its settings, variations, and targeting rules.
    /// </remarks>
    [OpenApi]
    [HttpPost("clone/{key}")]
    [Authorize(Permissions.CloneFlag)]
    public async Task<ApiResponse<bool>> CloneAsync(Guid envId, string key, CloneFlag request)
    {
        request.EnvId = envId;
        request.OriginFlagKey = key;

        var flag = await Mediator.Send(request);
        return Ok(flag);
    }

    [Authorize(LicenseFeatures.FlagComparison)]
    [HttpPost("compare-overview")]
    public async Task<ApiResponse<PagedResult<CompareFlagOverview>>> GetCompareOverviewAsync(Guid envId, GetCompareFlagOverview request)
    {
        request.SourceEnvId = envId;

        var overview = await Mediator.Send(request);
        return Ok(overview);
    }

    [Authorize(LicenseFeatures.FlagComparison)]
    [HttpGet("{key}/compare-with/{targetEnvId:guid}")]
    public async Task<ApiResponse<CompareFlagDetail>> CompareAsync(Guid envId, Guid targetEnvId, string key)
    {
        var request = new CompareFlag
        {
            Key = key,
            SourceEnvId = envId,
            TargetEnvId = targetEnvId
        };

        var diff = await Mediator.Send(request);
        return Ok(diff);
    }

    [Authorize(LicenseFeatures.FlagComparison)]
    [HttpPut("{key}/copy-settings-to/{targetEnvId:guid}")]
    public async Task<ApiResponse<bool>> CopySettingsAsync(Guid envId, string key, Guid targetEnvId, CopyFlagSettings request)
    {
        request.Key = key;
        request.SourceEnvId = envId;
        request.TargetEnvId = targetEnvId;

        var success = await Mediator.Send(request);
        return Ok(success);
    }

    /// <summary>
    /// Get all feature flag tags within an environment
    /// </summary>
    /// <remarks>
    /// Retrieve all unique tags used across feature flags in the environment.
    /// </remarks>
    [OpenApi]
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

    /// <summary>
    /// Set tags for a feature flag
    /// </summary>
    /// <remarks>
    /// Assign a list of tags to a feature flag for organization and filtering purposes.
    /// </remarks>
    [OpenApi]
    [HttpPut("{key}/tags")]
    [Authorize(Permissions.UpdateFlagTags)]
    public async Task<ApiResponse<bool>> SetTagsAsync(Guid envId, string key, string[] tags)
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