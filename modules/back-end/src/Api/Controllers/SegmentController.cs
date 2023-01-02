using Application.Bases.Models;
using Application.Segments;
using Domain.Segments;

namespace Api.Controllers;

[Route("api/v{version:apiVersion}/envs/{envId:guid}/segments")]
public class SegmentController : ApiControllerBase
{
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