using Application.Users;
using Domain.AuditLogs;

namespace Application.FeatureFlags;

public class ApplyFlagChangeRequest : IRequest<bool>
{
    public Guid OrgId { get; set; }

    public Guid EnvId { get; set; }

    public Guid Id { get; set; }
}

public class ApplyFlagChangeRequestHandler : IRequestHandler<ApplyFlagChangeRequest, bool>
{
    private readonly IFlagChangeRequestService _flagChangeRequestService;
    private readonly IFeatureFlagService _featureFlagService;
    private readonly IFlagDraftService _flagDraftService;
    private readonly ICurrentUser _currentUser;
    private readonly IPublisher _publisher;

    public ApplyFlagChangeRequestHandler(
        IFlagChangeRequestService flagChangeRequestService,
        IFeatureFlagService featureFlagService,
        IFlagDraftService flagDraftService,
        ICurrentUser currentUser,
        IPublisher publisher)
    {
        _flagChangeRequestService = flagChangeRequestService;
        _featureFlagService = featureFlagService;
        _currentUser = currentUser;
        _flagDraftService = flagDraftService;
        _publisher = publisher;
    }

    public async Task<bool> Handle(ApplyFlagChangeRequest request, CancellationToken cancellationToken)
    {
        var changeRequest = await _flagChangeRequestService.FindOneAsync(
            x => x.OrgId == request.OrgId && x.EnvId == request.EnvId && x.Id == request.Id
        );

        // check if change request can be applied by current user
        if (!changeRequest.CanBeAppliedBy(_currentUser.Id))
        {
            return false;
        }

        // check draft status
        var draft = await _flagDraftService.GetAsync(changeRequest.FlagDraftId);
        if (draft.IsApplied())
        {
            return false;
        }

        // apply flag draft
        var flag = await _featureFlagService.GetAsync(draft.FlagId);
        var dataChange = flag.ApplyDraft(draft);
        await _featureFlagService.UpdateAsync(flag);

        // update draft status
        draft.Applied(_currentUser.Id);
        await _flagDraftService.UpdateAsync(draft);

        // publish on feature flag change notification
        // TODO: should we use `draft.DataChange` instead?
        var notification = new OnFeatureFlagChanged(
            flag, Operations.ApplyFlagChangeRequest, dataChange, _currentUser.Id, draft.Comment
        );
        await _publisher.Publish(notification, cancellationToken);

        // update change request status
        changeRequest.Applied(_currentUser.Id);
        await _flagChangeRequestService.UpdateAsync(changeRequest);

        return true;
    }
}