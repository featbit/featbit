using System.Text.Json;
using Api.Authentication;
using Api.Swagger.Examples;
using Application.Bases.Models;
using Application.Segments;
using Domain.Policies;
using Domain.Segments;
using Microsoft.AspNetCore.JsonPatch;
using Microsoft.AspNetCore.JsonPatch.Operations;
using Newtonsoft.Json;
using Swashbuckle.AspNetCore.Filters;

namespace Api.Controllers;

[Route("api/v{version:apiVersion}/envs/{envId:guid}/segments")]
public class SegmentController : ApiControllerBase
{
    /// <summary>
    /// Get a segment
    /// </summary>
    /// <remarks>
    /// Get a single segment by id.
    /// </remarks>
    [OpenApi]
    [HttpGet("{segmentId:guid}")]
    [Authorize(Permissions.CanAccessEnv)]
    public async Task<ApiResponse<Segment>> GetAsync(Guid segmentId)
    {
        var request = new GetSegment
        {
            Id = segmentId
        };

        var segment = await Mediator.Send(request);
        return Ok(segment);
    }

    /// <summary>
    /// Get segment list of an environment
    /// </summary>
    /// <remarks>
    /// Get the list of segments of a particular environment.
    /// </remarks>
    [OpenApi]
    [HttpGet]
    [Authorize(Permissions.CanAccessEnv)]
    public async Task<ApiResponse<PagedResult<SegmentVm>>> GetListAsync(Guid envId, [FromQuery] SegmentFilter filter)
    {
        var request = new GetSegmentList
        {
            WorkspaceId = WorkspaceId,
            EnvId = envId,
            Filter = filter
        };

        var segments = await Mediator.Send(request);
        return Ok(segments);
    }

    /// <summary>
    /// Get segments by IDs
    /// </summary>
    /// <remarks>
    /// Retrieve multiple segments by providing an array of segment IDs.
    /// </remarks>
    [OpenApi]
    [HttpGet("by-ids")]
    [Authorize(Permissions.CanAccessEnv)]
    public async Task<ApiResponse<IEnumerable<Segment>>> GetByIdsAsync([FromQuery] Guid[] ids)
    {
        var request = new GetSegmentByIds
        {
            Ids = ids
        };

        var segments = await Mediator.Send(request);
        return Ok(segments);
    }

    /// <summary>
    /// Create a segment
    /// </summary>
    /// <remarks>
    /// Create a segment with the given settings.
    /// </remarks>
    [OpenApi]
    [HttpPost]
    [Authorize(Permissions.CreateSegment)]
    public async Task<ApiResponse<Segment>> CreateAsync(Guid envId, CreateSegment request)
    {
        request.WorkspaceId = WorkspaceId;
        request.EnvId = envId;

        var segment = await Mediator.Send(request);
        return Ok(segment);
    }

    /// <summary>
    /// Update a segment name
    /// </summary>
    /// <remarks>
    /// Update the display name of an existing segment.
    /// </remarks>
    [OpenApi]
    [HttpPut("{segmentId:guid}/name")]
    [Authorize(Permissions.UpdateSegmentName)]
    public async Task<ApiResponse<bool>> UpdateNameAsync(Guid segmentId, UpdateName request)
    {
        request.Id = segmentId;

        var success = await Mediator.Send(request);
        return Ok(success);
    }

    /// <summary>
    /// Update a segment description
    /// </summary>
    /// <remarks>
    /// Update the description field of an existing segment to provide additional context.
    /// </remarks>
    [OpenApi]
    [HttpPut("{segmentId:guid}/description")]
    [Authorize(Permissions.UpdateSegmentDescription)]
    public async Task<ApiResponse<bool>> UpdateDescriptionAsync(Guid segmentId, UpdateDescription request)
    {
        request.Id = segmentId;

        var success = await Mediator.Send(request);
        return Ok(success);
    }

    /// <summary>
    /// Update the targeting of a segment
    /// </summary>
    /// <remarks>
    /// Update the targeting rules, included and excluded users for a segment.
    /// </remarks>
    [OpenApi]
    [HttpPut("{segmentId:guid}/targeting")]
    public async Task<ApiResponse<bool>> UpdateTargetingAsync(Guid segmentId, UpdateTargetingPayload payload)
    {
        var permissions = await GetRequestPermissionsAsync();
        var request = new UpdateTargeting(segmentId, payload, permissions);

        var success = await Mediator.Send(request);
        return Ok(success);
    }

    /// <summary>
    /// Update a segment with the JSON patch method. Use with caution as this can make arbitrary changes to the
    /// segment, incorrect usage may lead to malformed data.
    /// </summary>
    /// <remarks>
    /// Perform a partial update to a segment. The request body must be a valid JSON patch.
    /// </remarks>
    [OpenApi]
    [SwaggerRequestExample(typeof(Operation), typeof(PatchSegmentExamples))]
    [HttpPatch("{segmentId:guid}")]
    public async Task<ApiResponse<bool>> PatchAsync(Guid segmentId, [FromBody] JsonElement jsonElement)
    {
        var patch = JsonConvert.DeserializeObject<JsonPatchDocument>(jsonElement.GetRawText());
        var request = new PatchSegment
        {
            Id = segmentId,
            Patch = patch
        };

        var result = await Mediator.Send(request);
        return result.Success ? Ok(true) : Error<bool>(result.Message);
    }

    /// <summary>
    /// Archive a segment
    /// </summary>
    /// <remarks>
    /// Archive a segment with the specified ID. Archived segments are hidden from the main list but can be restored later.
    /// </remarks>
    [OpenApi]
    [HttpPut("{segmentId:guid}/archive")]
    [Authorize(Permissions.ArchiveSegment)]
    public async Task<ApiResponse<bool>> ArchiveAsync(Guid envId, Guid segmentId)
    {
        var request = new ArchiveSegment
        {
            EnvId = envId,
            Id = segmentId
        };

        var success = await Mediator.Send(request);
        return Ok(success);
    }

    /// <summary>
    /// Restore a segment
    /// </summary>
    /// <remarks>
    /// Restore an archived segment with the specified ID, making it visible and usable again.
    /// </remarks>
    [OpenApi]
    [HttpPut("{segmentId:guid}/restore")]
    [Authorize(Permissions.RestoreSegment)]
    public async Task<ApiResponse<bool>> RestoreAsync(Guid segmentId)
    {
        var request = new RestoreSegment
        {
            Id = segmentId
        };

        var success = await Mediator.Send(request);
        return Ok(success);
    }

    /// <summary>
    /// Delete a segment
    /// </summary>
    /// <remarks>
    /// Permanently delete a segment with the specified ID. This action cannot be undone.
    /// </remarks>
    [OpenApi]
    [HttpDelete("{segmentId:guid}")]
    [Authorize(Permissions.DeleteSegment)]
    public async Task<ApiResponse<bool>> DeleteAsync(Guid segmentId)
    {
        var request = new DeleteSegment
        {
            Id = segmentId
        };

        var success = await Mediator.Send(request);
        return Ok(success);
    }

    [HttpGet("is-key-used")]
    public async Task<ApiResponse<bool>> IsKeyUsedAsync(Guid envId, string key, string type)
    {
        var request = new IsSegmentKeyUsed
        {
            WorkspaceId = WorkspaceId,
            EnvId = envId,
            Type = type,
            Key = key
        };

        var isUsed = await Mediator.Send(request);
        return Ok(isUsed);
    }

    /// <summary>
    /// Get feature flag references for a segment
    /// </summary>
    /// <remarks>
    /// Get the list of feature flags that reference this segment in their targeting rules.
    /// </remarks>
    [OpenApi]
    [HttpGet("{segmentId:guid}/flag-references")]
    [Authorize(Permissions.CanAccessEnv)]
    public async Task<ApiResponse<IEnumerable<FlagReference>>> GetFlagReferencesAsync(Guid envId, Guid segmentId)
    {
        var request = new GetFlagReferences
        {
            EnvId = envId,
            Id = segmentId
        };

        var references = await Mediator.Send(request);
        return Ok(references);
    }

    /// <summary>
    /// Get all segment tags within an environment
    /// </summary>
    /// <remarks>
    /// Retrieve all unique tags used across segments in the environment.
    /// </remarks>
    [OpenApi]
    [HttpGet("all-tags")]
    [Authorize(Permissions.CanAccessEnv)]
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
    /// Set tags for a segment
    /// </summary>
    /// <remarks>
    /// Assign a list of tags to a segment for organization and filtering purposes.
    /// </remarks>
    [OpenApi]
    [HttpPut("{segmentId:guid}/tags")]
    [Authorize(Permissions.UpdateSegmentTags)]
    public async Task<ApiResponse<bool>> SetTagsAsync(Guid segmentId, string[] tags)
    {
        var request = new SetTags
        {
            Id = segmentId,
            Tags = tags
        };

        var success = await Mediator.Send(request);
        return Ok(success);
    }
}