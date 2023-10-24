using Domain.AuditLogs;
using Domain.SemanticPatch;

namespace Application.FeatureFlags;

public class ScheduleVm
{
    public string Title { get; set; }
    public DateTime ScheduledTime { get; set; }
}

public class ChangeRequestVm
{
    public string Reason { get; set; }
    public ICollection<string> Reviewers { get; set; }
}

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
    
    // Schedule
    public string ScheduleTitle { get; set; }
    
    public DateTime ScheduledTime { get; set; }
    
    // Change request
    public Guid? ChangeRequestId { get; set; }
    
    public string ChangeRequestStatus { get; set; }
}