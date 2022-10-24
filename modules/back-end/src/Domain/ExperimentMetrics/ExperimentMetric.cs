namespace Domain.ExperimentMetrics;

public class ExperimentMetric : AuditedEntity
{
    public Guid EnvId { get; set; }
    public string Name { get; set; }
    public string Description { get; set; }
    public Guid MaintainerUserId { get; set; }
    public string EventName { get; set; }
    public EventType EventType { get; set; }
    public CustomEventTrackOption CustomEventTrackOption { get; set; }
    public string CustomEventUnit { get; set; }
    public CustomEventSuccessCriteria CustomEventSuccessCriteria { get; set; }

    public string ElementTargets { get; set; }
    public List<TargetUrl> TargetUrls { get; set; }

    public bool IsArvhived { get; set; }
}