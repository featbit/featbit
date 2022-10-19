using Domain.Experiments;

namespace Application.Experiments;

public class ExperimentMetricVm
{
    public string Id { get; set; }
    public string Name { get; set; }
    public Guid EnvId { get; set; }
    public string Description { get; set; }
    public string MaintainerUserId { get; set; }
    public string MaintainerUserName { get; set; }
    public string EventName { get; set; }
    public EventType EventType { get; set; }
    public CustomEventTrackOption CustomEventTrackOption { get; set; }
    public string CustomEventUnit { get; set; }
    public CustomEventSuccessCriteria CustomEventSuccessCriteria { get; set; }
    public string ElementTargets { get; set; }
    public List<TargetUrl> TargetUrls { get; set; }

    public bool IsArvhived { get; set; }
}