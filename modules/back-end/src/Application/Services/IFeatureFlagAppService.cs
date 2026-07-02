using Domain.Segments;

namespace Application.Services;

public interface IFeatureFlagAppService
{
    Task ApplyDraftAsync(Guid draftId, string operation, Guid operatorId);

    Task OnSegmentUpdatedAsync(Segment segment, Guid operatorId, ICollection<FlagReference> flagReferences);
}