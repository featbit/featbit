using Application.Users;
using Domain.AuditLogs;

namespace Application.FeatureFlags;

public class DeclineFlagChangeRequest : IRequest<bool>
{
    public Guid OrgId { get; set; }

    public Guid EnvId { get; set; }

    public Guid Id { get; set; }

    public string Comment { get; set; }
}

public class DeclineFlagChangeRequestHandler : IRequestHandler<DeclineFlagChangeRequest, bool>
{
    private readonly IFlagChangeRequestService _flagChangeRequestService;
    private readonly IFlagScheduleService _flagScheduleService;
    private readonly IFeatureFlagService _featureFlagService;
    private readonly IFlagDraftService _flagDraftService;
    private readonly IAuditLogService _auditLogService;
    private readonly ICurrentUser _currentUser;

    public DeclineFlagChangeRequestHandler(
        IFlagChangeRequestService flagChangeRequestService,
        IFlagScheduleService flagScheduleService,
        IFeatureFlagService featureFlagService,
        IFlagDraftService flagDraftService,
        IAuditLogService auditLogService,
        ICurrentUser currentUser)
    {
        _flagChangeRequestService = flagChangeRequestService;
        _flagScheduleService = flagScheduleService;
        _featureFlagService = featureFlagService;
        _flagDraftService = flagDraftService;
        _auditLogService = auditLogService;
        _currentUser = currentUser;
    }

    public async Task<bool> Handle(DeclineFlagChangeRequest request, CancellationToken cancellationToken)
    {
        var comment = request.Comment?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(comment))
        {
            return false;
        }

        var changeRequest = await _flagChangeRequestService.FindOneAsync(
            x => x.OrgId == request.OrgId && x.EnvId == request.EnvId && x.Id == request.Id
        );

        // check if change request can be declined by current user
        if (changeRequest?.CanBeDeclinedBy(_currentUser.Id) != true)
        {
            return false;
        }

        var flag = await _featureFlagService.FindOneAsync(
            x => x.EnvId == request.EnvId && x.Id == changeRequest.FlagId
        );
        if (flag == null)
        {
            return false;
        }

        var draft = await _flagDraftService.FindOneAsync(
            x => x.EnvId == request.EnvId && x.Id == changeRequest.FlagDraftId
        );
        if (draft == null)
        {
            return false;
        }

        changeRequest.Decline(_currentUser.Id);
        await _flagChangeRequestService.UpdateAsync(changeRequest);

        // update schedule status if change request is attached to a schedule
        if (changeRequest.ScheduleId.HasValue)
        {
            var schedule = await _flagScheduleService.GetAsync(changeRequest.ScheduleId.Value);
            schedule.Decline(_currentUser.Id);
            await _flagScheduleService.UpdateAsync(schedule);
        }

        var snapshot = new FlagChangeRequestDecisionAuditSnapshot
        {
            Id = flag.Id,
            Name = flag.Name,
            Key = flag.Key,
            ChangeRequestId = changeRequest.Id,
            RequestComment = changeRequest.Reason,
            ProposedDataChange = draft.DataChange
        };
        var dataChange = new DataChange().To(snapshot);
        var auditLog = AuditLog.For(
            flag,
            Operations.DeclineFlagChangeRequest,
            dataChange,
            comment,
            _currentUser.Id);
        await _auditLogService.AddOneAsync(auditLog);

        return true;
    }
}
