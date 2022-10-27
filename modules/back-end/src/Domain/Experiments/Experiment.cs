using Domain.ExperimentMetrics;

namespace Domain.Experiments;

public class Experiment : AuditedEntity
{
    public Guid EnvId { get; set; }
    public Guid MetricId { get; set; }
    public Guid FeatureFlagId { get; set; }
    
    public string Status { get; set; } // possible values: NotStarted, NotRecording, Recording

    public string BaselineVariationId { get; set; }

    public List<ExperimentIteration> Iterations { get; set; }
}

public class ExperimentIteration
{
    public string Id { get; set; }
    public DateTime StartTime { get; set; }
    public DateTime? EndTime { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public bool IsArvhived { get; set; }
    public int EventType { get; set; }
    public string EventName { get; set; }
    public CustomEventTrackOption CustomEventTrackOption { get; set; }
    public string CustomEventUnit { get; set; }
    public CustomEventSuccessCriteria CustomEventSuccessCriteria { get; set; }
    public List<IterationResult> Results { get; set; }
    public bool IsFinish { get; set; }
}

public class IterationResult
{
    public float? ChangeToBaseline { get; set; }
    public long? Conversion { get; set; }
    public long? TotalEvents { get; set; }
    public float? Average { get; set; }
    public float? ConversionRate { get; set; }
    public bool IsBaseline { get; set; }
    public bool IsInvalid { get; set; }
    public bool IsWinner { get; set; }
    public float? PValue { get; set; }
    public long? UniqueUsers { get; set; }
    public string Variation { get; set; }
    public List<float> ConfidenceInterval { get; set; }
}