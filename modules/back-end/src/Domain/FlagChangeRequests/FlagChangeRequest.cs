using System.Data;

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
    
    public FlagChangeRequest(
        Guid orgId,
        Guid envId,
        Guid flagDraftId,
        Guid flagId,
        string status,
        string reason,
        ICollection<Reviewer> reviewers,
        Guid currentUserId) : base(currentUserId)
    {
        if (!FlagChangeRequestStatus.IsDefined(status))
        {
            throw new ArgumentOutOfRangeException(nameof(status));
        }

        OrgId = orgId;
        EnvId = envId;
        FlagDraftId = flagDraftId;
        FlagId = flagId;
        Status = status;
        Reason = reason;
        Reviewers = reviewers;
    }
    
    public static FlagChangeRequest Pending(
        Guid orgId,
        Guid envId,
        Guid flagDraftId,
        Guid flagId,
        string reason,
        ICollection<Guid> reviewers,
        Guid currentUserId)
    {
        var reviewerList = reviewers.Select(x => new Reviewer { MemberId = x, Action = FlagChangeRequestAction.Empty, Timestamp = null }).ToList();
        return new FlagChangeRequest(orgId, envId, flagDraftId, flagId, FlagChangeRequestStatus.Pending, reason, reviewerList, currentUserId);
    }

    public bool IsReviewer(Guid memberId)
    {
        var reviewer = Reviewers.FirstOrDefault(r => r.MemberId == memberId);
        return reviewer != null;
    }
    
    public void Applied(Guid memberId)
    {
        Status = FlagChangeRequestStatus.Applied;
        
        MarkAsUpdated(memberId);
    }
    
    public void Approve(Guid memberId)
    {
        var reviewer = Reviewers.FirstOrDefault(r => r.MemberId == memberId);
        
        reviewer.Action = FlagChangeRequestAction.Approve;
        reviewer.Timestamp = DateTime.UtcNow;
        
        RefreshStatus();
        
        MarkAsUpdated(memberId);
    }
    
    public void Decline(Guid memberId)
    {
        var reviewer = Reviewers.FirstOrDefault(r => r.MemberId == memberId);
        
        reviewer.Action = FlagChangeRequestAction.Decline;
        reviewer.Timestamp = DateTime.UtcNow;

        RefreshStatus();
        
        MarkAsUpdated(memberId);
    }

    private void RefreshStatus()
    {
        if (Reviewers.Any(r => r.Action == FlagChangeRequestAction.Decline))
        {
            Status = FlagChangeRequestStatus.Declined;
        } 
        else if (Reviewers.Any(r => r.Action == FlagChangeRequestAction.Approve))
        {
            Status = FlagChangeRequestStatus.Approved;
        }
        else
        {
            Status = FlagChangeRequestStatus.Pending;
        }
    }
}