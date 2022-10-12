using Application.Bases.Models;
using Application.Segments;
using Domain.Segments;

namespace Application.Services;

public interface ISegmentService : IService<Segment>
{
    Task<PagedResult<Segment>> GetListAsync(Guid envId, SegmentFilter filter);

    Task<IEnumerable<Segment>> GetListAsync(Guid[] ids);

    Task<IEnumerable<FlagReference>> GetFlagReferencesAsync(Guid envId, Guid id);
}