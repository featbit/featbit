using Domain.AuditLogs;

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
}
