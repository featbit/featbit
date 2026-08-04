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

    public IEnumerable<PendingChangeReviewerVm> Reviewers { get; set; }

    public PendingChangesVm(FlagChangeRequest changeRequest)
    {
        Type = PendingChangeType.ChangeRequest;
        Id = changeRequest.Id;
        FlagId = changeRequest.FlagId;
        CreatedAt = changeRequest.CreatedAt;
        Status = changeRequest.Status;
        ChangeRequestReason = changeRequest.Reason;
        Reviewers = [.. changeRequest.Reviewers.Select(x => new PendingChangeReviewerVm(x))];
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
            Reviewers = [.. changeRequest.Reviewers.Select(x => new PendingChangeReviewerVm(x))];
        }
    }
}

public class PendingChangeReviewerVm
{
    public Guid MemberId { get; set; }

    public string Name { get; set; }

    public string Email { get; set; }

    public string Action { get; set; }

    public DateTime? Timestamp { get; set; }

    public PendingChangeReviewerVm(Reviewer reviewer)
    {
        MemberId = reviewer.MemberId;
        Action = reviewer.Action;
        Timestamp = reviewer.Timestamp;
    }
}
