using Domain.AuditLogs;
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

    public DateTime ScheduledTime { get; set; }

    public IEnumerable<FlagInstruction> Instructions { get; set; }
}