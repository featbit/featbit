using Domain.AuditLogs;
using Domain.FlagChangeRequests;
using Domain.FlagSchedules;
using Domain.SemanticPatch;

namespace Application.FeatureFlags;

public class PendingChangesVm
{
    public Guid Id { get; set; }

    public Guid FlagId { get; set; }

    public DataChange DataChange { get; set; }

    public Guid CreatorId { get; set; }

    public string CreatorName { get; set; }

    public DateTime CreatedAt { get; set; }

    public IEnumerable<FlagInstruction> Instructions { get; set; }

    public string Type { get; set; }

    public string Status { get; set; }

    // Schedule
    public string ScheduleTitle { get; set; }

    public DateTime ScheduledTime { get; set; }

    // Change request
    public Guid? ChangeRequestId { get; set; }

    public string ChangeRequestReason { get; set; }

    public IEnumerable<Reviewer> Reviewers { get; set; }

    public PendingChangesVm(FlagChangeRequest changeRequest)
    {
        Type = PendingChangeType.ChangeRequest;
        Id = changeRequest.Id;
        FlagId = changeRequest.FlagId;
        CreatedAt = changeRequest.CreatedAt;
        Status = changeRequest.Status;
        ChangeRequestReason = changeRequest.Reason;
        Reviewers = changeRequest.Reviewers;
    }

    public PendingChangesVm(FlagSchedule schedule, FlagChangeRequest changeRequest)
    {
        Type = PendingChangeType.Schedule;

        Id = schedule.Id;
        FlagId = schedule.FlagId;
        CreatedAt = schedule.CreatedAt;
        Status = schedule.Status;
        ScheduleTitle = schedule.Title;
        ScheduledTime = schedule.ScheduledTime;
        ChangeRequestId = schedule.ChangeRequestId;

        if (changeRequest != null)
        {
            ChangeRequestReason = changeRequest.Reason;
            Reviewers = changeRequest.Reviewers;
        }
    }
}