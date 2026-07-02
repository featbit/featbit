using Application.Bases.Models;
using Application.Segments;
using Domain.Segments;

namespace Application.Services;

public interface IEnvironmentAppService
{
    Task<PagedResult<Segment>> GetPagedSegmentsAsync(GetSegmentList request);

    Task<ICollection<Segment>> GetSegmentsAsync(Guid workspaceId, Guid envId);
}