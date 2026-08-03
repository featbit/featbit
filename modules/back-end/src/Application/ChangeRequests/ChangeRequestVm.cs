using Domain.AuditLogs;
using Domain.FeatureFlags;
using Domain.FlagChangeRequests;
using Domain.FlagDrafts;
using Domain.SemanticPatch;
using Domain.Users;

namespace Application.ChangeRequests;

public class ChangeRequestListVm
{
    public long TotalCount { get; set; }

    public long NeedsReviewCount { get; set; }

    public IReadOnlyList<ChangeRequestVm> Items { get; set; }

    public ChangeRequestListVm(long totalCount, long needsReviewCount, IReadOnlyList<ChangeRequestVm> items)
    {
        TotalCount = totalCount;
        NeedsReviewCount = needsReviewCount;
        Items = items;
    }
}

public class ChangeRequestVm
{
    public Guid Id { get; set; }

    public Guid FlagId { get; set; }

    public string FlagName { get; set; }

    public string FlagKey { get; set; }

    public string ScopeRn { get; set; }

    public string Reason { get; set; }

    public string Status { get; set; }

    public Guid CreatorId { get; set; }

    public string CreatorName { get; set; }

    public string CreatorEmail { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public Guid UpdatorId { get; set; }

    public string UpdatorName { get; set; }

    public string UpdatorEmail { get; set; }

    public DataChange DataChange { get; set; }

    public IEnumerable<FlagInstruction> Instructions { get; set; }

    public IReadOnlyList<ChangeRequestReviewerVm> Reviewers { get; set; }

    public bool CanReview { get; set; }

    public bool CanApply { get; set; }

    public ChangeRequestVm(
        FlagChangeRequest changeRequest,
        FeatureFlag flag,
        FlagDraft draft,
        User creator,
        User updator,
        IReadOnlyDictionary<Guid, (string Name, string Email)> reviewerMembers,
        string scopeRn,
        Guid currentUserId)
    {
        Id = changeRequest.Id;
        FlagId = changeRequest.FlagId;
        FlagName = flag?.Name ?? string.Empty;
        FlagKey = flag?.Key ?? string.Empty;
        ScopeRn = scopeRn;
        Reason = changeRequest.Reason;
        Status = changeRequest.Status;
        CreatorId = changeRequest.CreatorId;
        CreatorName = creator?.Name ?? string.Empty;
        CreatorEmail = creator?.Email ?? string.Empty;
        CreatedAt = changeRequest.CreatedAt;
        UpdatedAt = changeRequest.UpdatedAt;
        UpdatorId = changeRequest.UpdatorId;
        UpdatorName = updator?.Name ?? string.Empty;
        UpdatorEmail = updator?.Email ?? string.Empty;
        DataChange = draft?.DataChange ?? new DataChange();
        Instructions = draft == null
            ? []
            : FlagComparer.Compare(draft.DataChange);
        Reviewers = changeRequest.Reviewers.Select(reviewer =>
        {
            reviewerMembers.TryGetValue(reviewer.MemberId, out var member);
            return new ChangeRequestReviewerVm(reviewer, member.Name, member.Email);
        }).ToArray();
        CanReview = changeRequest.Status == FlagChangeRequestStatus.PendingReview &&
                    changeRequest.CanBeApprovedBy(currentUserId);
        CanApply = changeRequest.CanBeAppliedBy(currentUserId);
    }
}

public class ChangeRequestReviewerVm
{
    public Guid MemberId { get; set; }

    public string Name { get; set; }

    public string Email { get; set; }

    public string Action { get; set; }

    public DateTime? Timestamp { get; set; }

    public ChangeRequestReviewerVm(Reviewer reviewer, string name, string email)
    {
        MemberId = reviewer.MemberId;
        Name = name ?? string.Empty;
        Email = email ?? string.Empty;
        Action = reviewer.Action;
        Timestamp = reviewer.Timestamp;
    }
}

public class ChangeRequestPreviewVm
{
    public Guid Id { get; set; }

    public string Reason { get; set; }

    public string Status { get; set; }

    public FeatureFlag Flag { get; set; }

    public ChangeRequestPreviewVm(FlagChangeRequest changeRequest, FeatureFlag flag)
    {
        Id = changeRequest.Id;
        Reason = changeRequest.Reason;
        Status = changeRequest.Status;
        Flag = flag;
    }
}
