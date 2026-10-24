using Domain.Segments;

namespace Application.Services;

public interface IFeatureFlagAppService
{
    Task ApplyDraftAsync(Guid workspaceId, Guid orgId, Guid draftId, string operation, Guid operatorId);

    Task OnSegmentUpdatedAsync(Guid workspaceId, Guid? orgId, Segment segment, Guid operatorId, ICollection<FlagReference> flagReferences);
}
