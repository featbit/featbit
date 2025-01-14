using Application.Bases.Models;
using Application.Segments;
using Domain.Segments;

namespace Application.Services;

public interface ISegmentService : IService<Segment>
{
    Task<PagedResult<Segment>> GetListAsync(Guid workspaceId, string rn, SegmentFilter filter);

    Task<ICollection<Segment>> GetListAsync(Guid workspaceId, string rn, bool includeArchived = false);

    Task<ICollection<FlagReference>> GetFlagReferencesAsync(Guid envId, Guid id);

    Task DeleteAsync(Guid id);
}