using Application.FeatureFlags;
using MediatR;

namespace Infrastructure.FeatureFlags;

public class FeatureFlagAppService : IFeatureFlagAppService
{
    private readonly IFeatureFlagService _featureFlagService;
    private readonly IFlagDraftService _flagDraftService;
    private readonly IPublisher _publisher;

    public FeatureFlagAppService(
        IFeatureFlagService featureFlagService,
        IFlagDraftService flagDraftService,
        IPublisher publisher)
    {
        _featureFlagService = featureFlagService;
        _flagDraftService = flagDraftService;
        _publisher = publisher;
    }

    public async Task ApplyDraftAsync(Guid draftId, string operation, Guid operatorId)
    {
        // check draft status
        var draft = await _flagDraftService.GetAsync(draftId);
        if (draft.IsApplied())
        {
            return;
        }

        // apply flag draft
        var flag = await _featureFlagService.GetAsync(draft.FlagId);
        var dataChange = flag.ApplyDraft(draft);
        await _featureFlagService.UpdateAsync(flag);

        // update draft status
        draft.Applied(operatorId);
        await _flagDraftService.UpdateAsync(draft);

        // publish on feature flag change notification
        var notification = new OnFeatureFlagChanged(
            flag, operation, dataChange, operatorId, draft.Comment
        );
        await _publisher.Publish(notification);
    }
}