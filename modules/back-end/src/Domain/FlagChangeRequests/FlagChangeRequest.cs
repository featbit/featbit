namespace Domain.FlagChangeRequests;

public class FlagChangeRequest : FullAuditedEntity
{
    public Guid OrgId { get; set; }

    public Guid EnvId { get; set; }

    public Guid FlagDraftId { get; set; }

    public Guid FlagId { get; set; }

    public string Status { get; set; }

    public string Reason { get; set; }

    public ICollection<Reviewer> Reviewers { get; set; }

    public Guid? ScheduleId { get; set; }

    public FlagChangeRequest(
        Guid orgId,
        Guid envId,
        Guid flagDraftId,
        Guid flagId,
        ICollection<Guid> reviewers,
        Guid currentUserId,
        Guid? scheduleId = null,
        string reason = "",
        string status = FlagChangeRequestStatus.PendingReview) : base(currentUserId)
    {
        if (!FlagChangeRequestStatus.IsDefined(status))
        {
            throw new ArgumentOutOfRangeException(nameof(status));
        }

        OrgId = orgId;
        EnvId = envId;
        FlagDraftId = flagDraftId;
        FlagId = flagId;
        Reviewers = reviewers.Select(x => new Reviewer(x)).ToArray();
        ScheduleId = scheduleId;

        Status = status;
        Reason = reason;
    }

    public void AttachSchedule(Guid scheduleId) => ScheduleId = scheduleId;

    public bool CanBeApprovedBy(Guid operatorId)
    {
        if (Status == FlagChangeRequestStatus.Applied)
        {
            return false;
        }

        var isReviewer = Reviewers.Any(r => r.MemberId == operatorId);
        return isReviewer;
    }

    public bool CanBeAppliedBy(Guid operatorId)
    {
        if (Status != FlagChangeRequestStatus.Approved)
        {
            return false;
        }

        var isReviewer = Reviewers.Any(r => r.MemberId == operatorId);
        var isCreator = CreatorId == operatorId;

        return isReviewer || isCreator;
    }

    public bool CanBeDeclinedBy(Guid operatorId)
    {
        if (Status == FlagChangeRequestStatus.Applied)
        {
            return false;
        }

        var isReviewer = Reviewers.Any(r => r.MemberId == operatorId);
        return isReviewer;
    }

    public void Applied(Guid memberId)
    {
        Status = FlagChangeRequestStatus.Applied;

        MarkAsUpdated(memberId);
    }

    public void Approve(Guid memberId)
    {
        var reviewer = Reviewers.First(r => r.MemberId == memberId);
        reviewer.Action = FlagChangeRequestAction.Approve;
        reviewer.Timestamp = DateTime.UtcNow;

        RefreshStatus();

        MarkAsUpdated(memberId);
    }

    public void Decline(Guid memberId)
    {
        var reviewer = Reviewers.First(r => r.MemberId == memberId);
        reviewer.Action = FlagChangeRequestAction.Decline;
        reviewer.Timestamp = DateTime.UtcNow;

        RefreshStatus();

        MarkAsUpdated(memberId);
    }

    private void RefreshStatus()
    {
        if (Reviewers.Any(reviewer => reviewer.Action == FlagChangeRequestAction.Decline))
        {
            Status = FlagChangeRequestStatus.Declined;
        }
        else if (Reviewers.Any(reviewer => reviewer.Action == FlagChangeRequestAction.Approve))
        {
            Status = FlagChangeRequestStatus.Approved;
        }
        else
        {
            Status = FlagChangeRequestStatus.PendingReview;
        }
    }
}