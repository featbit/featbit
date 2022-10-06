using System.Linq.Expressions;
using Application.Bases.Models;
using Application.Segments;
using Domain.Segments;

namespace Application.Services;

public interface ISegmentService
{
    Task<Segment> GetAsync(Guid id);

    Task AddAsync(Segment segment);

    Task UpdateAsync(Segment segment);

    Task<bool> AnyAsync(Expression<Func<Segment, bool>> predicate);

    Task<PagedResult<Segment>> GetListAsync(Guid envId, SegmentFilter filter);

    Task<IEnumerable<Segment>> GetListAsync(Guid[] ids);
}