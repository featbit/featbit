using Application.Users;
using Domain.AuditLogs;
using Domain.FlagChangeRequests;
using Domain.FlagDrafts;

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
        var changeRequest = await _flagChangeRequestService.FindOneAsync(x => x.OrgId == request.OrgId && x.EnvId == request.EnvId && x.Id == request.Id);

        if (changeRequest == null || changeRequest.Status != FlagChangeRequestStatus.Approved || 
            (!changeRequest.IsReviewer(_currentUser.Id) && changeRequest.CreatorId != _currentUser.Id))
        {
            return false;
        }

        // Apply changes
        var flagDraft = await _flagDraftService.FindOneAsync(x =>
            x.Id == changeRequest.FlagDraftId && x.Status == FlagDraftStatus.Pending);

        if (flagDraft == null)
        {
            return true;
        }

        var instructions = flagDraft.GetInstructions();
        var flag = await _featureFlagService.GetAsync(flagDraft.FlagId);

        // apply flag instructions
        flag.ApplyInstructions(instructions, flagDraft.CreatorId);
        await _featureFlagService.UpdateAsync(flag);

        // set draft and schedule status
        flagDraft.Applied(_currentUser.Id);
        changeRequest.Applied(_currentUser.Id);
        await _flagDraftService.UpdateAsync(flagDraft);
        await _flagChangeRequestService.UpdateAsync(changeRequest);

        // publish on feature flag change notification
        var notification = new OnFeatureFlagChanged(
            flag, Operations.ApplyFlagChangeRequest, flagDraft.DataChange, _currentUser.Id, flagDraft.Comment
        );
        await _publisher.Publish(notification, cancellationToken);

        return true;
    }
}