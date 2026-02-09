using System.Text.Json;
using Api.Authentication;
using Api.Authorization;
using Api.Swagger.Examples;
using Application.Bases.Models;
using Application.Segments;
using Domain.Segments;
using Microsoft.AspNetCore.JsonPatch;
using Microsoft.AspNetCore.JsonPatch.Operations;
using Newtonsoft.Json;
using Swashbuckle.AspNetCore.Filters;

namespace Api.Controllers;

[Authorize(Permissions.ManageSegment)]
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
    [HttpGet("{id:guid}")]
    public async Task<ApiResponse<Segment>> GetAsync(Guid id)
    {
        var request = new GetSegment
        {
            Id = id
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
    [HttpPut("{id:guid}/name")]
    public async Task<ApiResponse<bool>> UpdateNameAsync(Guid id, UpdateName request)
    {
        request.Id = id;

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
    [HttpPut("{id:guid}/description")]
    public async Task<ApiResponse<bool>> UpdateDescriptionAsync(Guid id, UpdateDescription request)
    {
        request.Id = id;

        var success = await Mediator.Send(request);
        return Ok(success);
    }

    /// <summary>
    /// Update segment targeting rules
    /// </summary>
    /// <remarks>
    /// Update the targeting rules, included and excluded users for a segment.
    /// </remarks>
    [OpenApi]
    [HttpPut("{id:guid}/targeting")]
    public async Task<ApiResponse<bool>> UpdateTargetingAsync(Guid id, UpdateTargeting request)
    {
        request.Id = id;

        var success = await Mediator.Send(request);
        return Ok(success);
    }

    /// <summary>
    /// Update a segment with the JSON patch method
    /// </summary>
    /// <remarks>
    /// Perform a partial update to a segment. The request body must be a valid JSON patch.
    /// </remarks>
    [OpenApi]
    [SwaggerRequestExample(typeof(Operation), typeof(PatchSegmentExamples))]
    [HttpPatch("{id}")]
    public async Task<ApiResponse<bool>> PatchAsync(Guid id, [FromBody] JsonElement jsonElement)
    {
        var patch = JsonConvert.DeserializeObject<JsonPatchDocument>(jsonElement.GetRawText());
        var request = new PatchSegment
        {
            Id = id,
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
    [HttpPut("{id:guid}/archive")]
    public async Task<ApiResponse<bool>> ArchiveAsync(Guid envId, Guid id)
    {
        var request = new ArchiveSegment
        {
            EnvId = envId,
            Id = id
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
    [HttpPut("{id:guid}/restore")]
    public async Task<ApiResponse<bool>> RestoreAsync(Guid id)
    {
        var request = new RestoreSegment
        {
            Id = id
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
    [HttpDelete("{id:guid}")]
    public async Task<ApiResponse<bool>> DeleteAsync(Guid id)
    {
        var request = new DeleteSegment
        {
            Id = id
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
    [HttpGet]
    [Route("{id:guid}/flag-references")]
    public async Task<ApiResponse<IEnumerable<FlagReference>>> GetFlagReferencesAsync(Guid envId, Guid id)
    {
        var request = new GetFlagReferences
        {
            EnvId = envId,
            Id = id
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
    [HttpPut("{id:guid}/tags")]
    public async Task<ApiResponse<bool>> SetTagsAsync(Guid id, string[] tags)
    {
        var request = new SetTags
        {
            Id = id,
            Tags = tags
        };

        var success = await Mediator.Send(request);
        return Ok(success);
    }
}