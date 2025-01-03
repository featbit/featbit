using Domain.Segments;

namespace Application.Services;

public interface ISegmentAppService
{
    Task<ICollection<Guid>> GetEnvironmentIdsAsync(Segment segment);
}