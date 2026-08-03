using Domain.AuditLogs;
using Domain.FeatureFlags;
using Domain.FlagChangeRequests;
using Domain.FlagDrafts;

namespace Application.FeatureFlags;

public class ChangeRequestDecision
{
    public string Comment { get; set; }
}

public class FlagChangeRequestDecisionAuditSnapshot
{
    public Guid Id { get; set; }

    public string Name { get; set; }

    public string Key { get; set; }

    public Guid ChangeRequestId { get; set; }

    public string RequestComment { get; set; }

    public DataChange ProposedDataChange { get; set; }

    public FlagChangeRequestDecisionAuditSnapshot(FeatureFlag flag, FlagChangeRequest changeRequest, FlagDraft draft)
    {
        Id = flag.Id;
        Name = flag.Name;
        Key = flag.Key;
        ChangeRequestId = changeRequest.Id;
        RequestComment = changeRequest.Reason;
        ProposedDataChange = draft.DataChange;
    }
}
