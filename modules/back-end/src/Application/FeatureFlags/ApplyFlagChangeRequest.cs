using Application.Users;
using Domain.AuditLogs;
using Domain.FlagChangeRequests;

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
    private readonly IAuditLogService _auditLogService;
    private readonly ICurrentUser _currentUser;
    private readonly IPublisher _publisher;

    public ApplyFlagChangeRequestHandler(
        IFlagChangeRequestService flagChangeRequestService,
        IFeatureFlagService featureFlagService,
        IFlagDraftService flagDraftService,
        IAuditLogService auditLogService,
        ICurrentUser currentUser,
        IPublisher publisher)
    {
        _flagChangeRequestService = flagChangeRequestService;
        _featureFlagService = featureFlagService;
        _currentUser = currentUser;
        _flagDraftService = flagDraftService;
        _auditLogService = auditLogService;
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
        var flagDraft = await _flagDraftService.FindOneAsync(x => x.Id == changeRequest.FlagDraftId);
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

        // write audit log
        var auditLog = AuditLog.ForApplyFlagChangeRequest(flag, flagDraft.DataChange, flagDraft.Comment, flagDraft.CreatorId);
        await _auditLogService.AddOneAsync(auditLog);

        // publish on feature flag change notification
        await _publisher.Publish(new OnFeatureFlagChanged(flag, flagDraft.Comment), cancellationToken);
        
        return true;
    }
}