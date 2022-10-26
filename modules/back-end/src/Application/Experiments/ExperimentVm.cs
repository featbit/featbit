using Domain.ExperimentMetrics;
using Domain.FeatureFlags;

namespace Application.Experiments;

public class ExperimentVm
{
    public Guid Id { get; set; }
    public Variation BaselineVariation { get; set; }
    public Guid FeatureFlagId { get; set; }
    public string FeatureFlagKey { get; set; }
    public string FeatureFlagName { get; set; }
    
    public Guid MetricId { get; set; }
    public string MetricName { get; set; }
    public string MetricEventName { get; set; }
    public EventType MetricEventType { get; set; }
    public CustomEventTrackOption MetricCustomEventTrackOption { get; set; }
    public string Status { get; set; }
}