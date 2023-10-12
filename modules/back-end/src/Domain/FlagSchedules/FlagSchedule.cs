﻿namespace Domain.FlagSchedules;

public class FlagSchedule : FullAuditedEntity
{
    public Guid OrgId { get; set; }

    public Guid EnvId { get; set; }

    public Guid FlagDraftId { get; set; }

    public Guid FlagId { get; set; }

    public string Status { get; set; }

    public string Title { get; set; }

    public DateTime ScheduledTime { get; set; }

    public FlagSchedule(
        Guid orgId,
        Guid envId,
        Guid flagDraftId,
        Guid flagId,
        string status,
        string title,
        DateTime scheduledTime,
        Guid currentUserId) : base(currentUserId)
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
    }

    public static FlagSchedule WaitingForExecution(
        Guid orgId,
        Guid envId,
        Guid flagDraftId,
        Guid flagId,
        string title,
        DateTime scheduledTime,
        Guid currentUserId)
    {
        return new FlagSchedule(orgId, envId, flagDraftId, flagId, FlagScheduleStatus.Pending, title, scheduledTime, currentUserId);
    }

    public void Applied()
    {
        Status = FlagScheduleStatus.Applied;
        UpdatedAt = DateTime.UtcNow;
    }
}