using Domain.Targeting;

namespace Domain.Experiments;

public class ExperimentMetric : FullAuditedEntity
{
    public ExperimentMetric(Guid creatorId) : base(creatorId)
    {
    }

    public Guid EnvId { get; set; }
    public string Name { get; set; }
    public string Description { get; set; }
    public string MaintainerUserId { get; set; }
    public string EventName { get; set; }
    public EventType EventType { get; set; }
    public CustomEventTrackOption CustomEventTrackOption { get; set; }
    public string CustomEventUnit { get; set; }
    public CustomEventSuccessCriteria CustomEventSuccessCriteria { get; set; }

    // TODO add properties for page view and click
    public string ElementTargets { get; set; }
    public List<TargetUrl> TargetUrls { get; set; }

    public bool IsArvhived { get; set; }
}