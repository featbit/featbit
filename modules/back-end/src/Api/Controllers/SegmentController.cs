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
            EnvId = envId,
            Filter = filter
        };

        var segments = await Mediator.Send(request);
        return Ok(segments);
    }

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
        request.EnvId = envId;

        var segment = await Mediator.Send(request);
        return Ok(segment);
    }

    [HttpPut("{id:guid}")]
    public async Task<ApiResponse<Segment>> UpdateAsync(Guid id, UpdateSegment request)
    {
        request.Id = id;

        var segment = await Mediator.Send(request);
        return Ok(segment);
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
    [OpenApi]
    [HttpPut("{id:guid}/archive")]
    public async Task<ApiResponse<bool>> ArchiveAsync(Guid id)
    {
        var request = new ArchiveSegment
        {
            Id = id
        };

        var success = await Mediator.Send(request);
        return Ok(success);
    }

    /// <summary>
    /// Restore a segment
    /// </summary>
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
    [OpenApi]
    [HttpDelete("{id:guid}")]
    public async Task<ApiResponse<bool>> DeleteAsync(Guid envId, Guid id)
    {
        var request = new DeleteSegment
        {
            EnvId = envId,
            Id = id
        };

        var success = await Mediator.Send(request);
        return Ok(success);
    }

    [HttpGet("is-name-used")]
    public async Task<ApiResponse<bool>> IsNameUsedAsync(Guid envId, string name)
    {
        var request = new IsSegmentNameUsed
        {
            EnvId = envId,
            Name = name
        };

        var isNameUsed = await Mediator.Send(request);
        return Ok(isNameUsed);
    }

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
}