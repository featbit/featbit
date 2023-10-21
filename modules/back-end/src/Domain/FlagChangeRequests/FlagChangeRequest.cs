namespace Domain.FlagChangeRequests;

public class FlagChangeRequest : FullAuditedEntity
{
    public Guid OrgId { get; set; }

    public Guid EnvId { get; set; }

    public Guid FlagDraftId { get; set; }

    public Guid FlagId { get; set; }

    public string Status { get; set; }

    public string Reason { get; set; }
    
    public ICollection<Guid> Reviewers { get; set; }
    
    public FlagChangeRequest(
        Guid orgId,
        Guid envId,
        Guid flagDraftId,
        Guid flagId,
        string status,
        string reason,
        ICollection<Guid> reviewers,
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
        return new FlagChangeRequest(orgId, envId, flagDraftId, flagId, FlagChangeRequestStatus.Pending, reason, reviewers, currentUserId);
    }
}