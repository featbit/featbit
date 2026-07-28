using Domain.AuditLogs;
using Domain.SemanticPatch;

namespace Application.ChangeRequests;

public class ChangeRequestListVm
{
    public long TotalCount { get; set; }

    public long NeedsReviewCount { get; set; }

    public IReadOnlyList<ChangeRequestVm> Items { get; set; }
}

public class ChangeRequestVm
{
    public Guid Id { get; set; }

    public Guid FlagId { get; set; }

    public string FlagName { get; set; }

    public string FlagKey { get; set; }

    public string Reason { get; set; }

    public string Status { get; set; }

    public Guid CreatorId { get; set; }

    public string CreatorName { get; set; }

    public string CreatorEmail { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public DataChange DataChange { get; set; }

    public IEnumerable<FlagInstruction> Instructions { get; set; }

    public IReadOnlyList<ChangeRequestReviewerVm> Reviewers { get; set; }

    public bool CanReview { get; set; }

    public bool CanApply { get; set; }
}

public class ChangeRequestReviewerVm
{
    public Guid MemberId { get; set; }

    public string Name { get; set; }

    public string Email { get; set; }

    public string Action { get; set; }

    public DateTime? Timestamp { get; set; }
}
