using Application.Bases;
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

public class DeclineFlagChangeRequestValidator : AbstractValidator<DeclineFlagChangeRequest>
{
    public DeclineFlagChangeRequestValidator()
    {
        RuleFor(x => x.Comment)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("comment"));
    }
}

public class DeclineFlagChangeRequestHandler(
    IFlagChangeRequestService changeRequestService,
    IFlagScheduleService scheduleService,
    IFeatureFlagService flagService,
    IFlagDraftService draftService,
    IAuditLogService auditLogService,
    ICurrentUser currentUser)
    : IRequestHandler<DeclineFlagChangeRequest, bool>
{
    public async Task<bool> Handle(DeclineFlagChangeRequest request, CancellationToken cancellationToken)
    {
        var changeRequest = await changeRequestService.FindOneAsync(
            x => x.OrgId == request.OrgId && x.EnvId == request.EnvId && x.Id == request.Id
        );

        // check if change request can be declined by current user
        if (changeRequest?.CanBeDeclinedBy(currentUser.Id) != true)
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

        changeRequest.Decline(currentUser.Id);
        await changeRequestService.UpdateAsync(changeRequest);

        // update schedule status if change request is attached to a schedule
        if (changeRequest.ScheduleId.HasValue)
        {
            var schedule = await scheduleService.GetAsync(changeRequest.ScheduleId.Value);
            schedule.Decline(currentUser.Id);
            await scheduleService.UpdateAsync(schedule);
        }

        // write audit log
        var snapshot = new FlagChangeRequestDecisionAuditSnapshot(flag, changeRequest, draft);
        var dataChange = new DataChange().To(snapshot);
        var auditLog = AuditLog.For(
            flag,
            Operations.DeclineFlagChangeRequest,
            dataChange,
            request.Comment?.Trim() ?? string.Empty,
            currentUser.Id
        );
        await auditLogService.AddOneAsync(auditLog);

        return true;
    }
}
