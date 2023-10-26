namespace Domain.FlagSchedules;

public class FlagSchedule : FullAuditedEntity
{
    public Guid OrgId { get; set; }

    public Guid EnvId { get; set; }

    public Guid FlagDraftId { get; set; }

    public Guid FlagId { get; set; }

    public string Status { get; set; }

    public string Title { get; set; }

    public DateTime ScheduledTime { get; set; }

    public Guid? ChangeRequestId { get; set; }

    public FlagSchedule(
        Guid orgId,
        Guid envId,
        Guid flagDraftId,
        Guid flagId,
        string status,
        string title,
        DateTime scheduledTime,
        Guid currentUserId,
        Guid? changeRequestId) : base(currentUserId)
    {
        if (!FlagScheduleStatus.IsDefined(status))
        {
            throw new ArgumentOutOfRangeException(nameof(status));
        }

        OrgId = orgId;
        EnvId = envId;
        FlagDraftId = flagDraftId;
        FlagId = flagId;
        Status = status;
        Title = title;
        ScheduledTime = scheduledTime;
        ChangeRequestId = changeRequestId;
    }

    public static FlagSchedule PendingExecution(
        Guid orgId,
        Guid envId,
        Guid flagDraftId,
        Guid flagId,
        string title,
        DateTime scheduledTime,
        Guid currentUserId)
    {
        return new FlagSchedule(orgId, envId, flagDraftId, flagId, FlagScheduleStatus.PendingExecution, title, scheduledTime, currentUserId, null);
    }
    
    public static FlagSchedule PendingReview(
        Guid orgId,
        Guid envId,
        Guid flagDraftId,
        Guid flagId,
        string title,
        DateTime scheduledTime,
        Guid currentUserId,
        Guid? changeRequestId)
    {
        return new FlagSchedule(orgId, envId, flagDraftId, flagId, FlagScheduleStatus.PendingReview, title, scheduledTime, currentUserId, changeRequestId);
    }

    public void Applied(Guid memberId)
    {
        Status = FlagScheduleStatus.Applied;
        MarkAsUpdated(memberId);
    }
    
    public void PendingExecution(Guid memberId)
    {
        Status = FlagScheduleStatus.PendingExecution;
        MarkAsUpdated(memberId);
    }
}