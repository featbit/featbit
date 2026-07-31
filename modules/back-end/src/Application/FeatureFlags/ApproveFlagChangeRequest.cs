using Application.Users;
using Domain.AuditLogs;

namespace Application.FeatureFlags;

public class ApproveFlagChangeRequest : IRequest<bool>
{
    public Guid OrgId { get; set; }

    public Guid EnvId { get; set; }

    public Guid Id { get; set; }

    public string Comment { get; set; }
}

public class ApproveFlagChangeRequestHandler(
    IFlagChangeRequestService changeRequestService,
    IFlagScheduleService scheduleService,
    IFeatureFlagService flagService,
    IFlagDraftService draftService,
    IAuditLogService auditLogService,
    ICurrentUser currentUser)
    : IRequestHandler<ApproveFlagChangeRequest, bool>
{
    public async Task<bool> Handle(ApproveFlagChangeRequest request, CancellationToken cancellationToken)
    {
        var changeRequest = await changeRequestService.FindOneAsync(
            x => x.OrgId == request.OrgId && x.EnvId == request.EnvId && x.Id == request.Id
        );

        // check if change request can be approved by current user
        if (changeRequest?.CanBeApprovedBy(currentUser.Id) != true)
        {
            return false;
        }

        var flag = await flagService.FindOneAsync(
            x => x.EnvId == request.EnvId && x.Id == changeRequest.FlagId
        );
        if (flag == null)
        {
            return false;
        }

        var draft = await draftService.FindOneAsync(
            x => x.EnvId == request.EnvId && x.Id == changeRequest.FlagDraftId
        );
        if (draft == null)
        {
            return false;
        }

        var comment = request.Comment?.Trim() ?? string.Empty;
        changeRequest.Approve(currentUser.Id);
        await changeRequestService.UpdateAsync(changeRequest);

        // update schedule status if exists
        if (changeRequest.ScheduleId.HasValue)
        {
            var schedule = await scheduleService.GetAsync(changeRequest.ScheduleId.Value);
            schedule.PendingExecution(currentUser.Id);
            await scheduleService.UpdateAsync(schedule);
        }

        // write audit log
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
            Operations.ApproveFlagChangeRequest,
            dataChange,
            comment,
            currentUser.Id
        );
        await auditLogService.AddOneAsync(auditLog);

        return true;
    }
}
