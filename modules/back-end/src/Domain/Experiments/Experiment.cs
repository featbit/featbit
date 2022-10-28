using System.Text.Json.Serialization;
using Domain.ExperimentMetrics;

namespace Domain.Experiments;

public class Experiment : AuditedEntity
{
    public Guid EnvId { get; set; }
    public Guid MetricId { get; set; }
    public Guid FeatureFlagId { get; set; }
    public bool IsArchived { get; set; }
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
    public bool IsArchived { get; set; }
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
    public List<float> ConfidenceInterval { get; set; }
    public long? Conversion { get; set; }
    public float? ConversionRate { get; set; }
    public long? TotalEvents { get; set; }
    public float? Average { get; set; }
    public bool IsBaseline { get; set; }
    public bool IsInvalid { get; set; }
    public bool IsWinner { get; set; }
    public float? PValue { get; set; }
    public long? UniqueUsers { get; set; }
    public string VariationId { get; set; }
}

public class ExptIterationParam
{
    [JsonPropertyName("exptId")]
    public Guid ExptId { get; set; }
    
    [JsonPropertyName("iterationId")]
    public string IterationId { get; set; }
    
    [JsonPropertyName("envId")]
    public Guid EnvId { get; set; }
    
    [JsonPropertyName("flagExptId")]
    public string FlagExptId { get; set; }
    
    [JsonPropertyName("baselineVariationId")]
    public string BaselineVariationId { get; set; }
    
    [JsonPropertyName("variationIds")]
    public IEnumerable<string> VariationIds { get; set; }
    
    [JsonPropertyName("eventName")]
    public string EventName { get; set; }
    
    [JsonPropertyName("eventType")]
    public int EventType { get; set; }
    
    [JsonPropertyName("customEventTrackOption")]
    public int CustomEventTrackOption { get; set; }
    
    [JsonPropertyName("customEventSuccessCriteria")]
    public int CustomEventSuccessCriteria { get; set; }
    
    [JsonPropertyName("customEventUnit")]
    public string CustomEventUnit { get; set; }
    
    [JsonPropertyName("startExptTime")]
    public string StartExptTime { get; set; } // format "2021-09-20T21:00:00.123456"
    
    [JsonPropertyName("endExptTime")]
    public string EndExptTime { get; set; } // format "2021-09-20T21:00:00.123456"
}

public class OlapExptIterationResponse
{
    public int Code { get; set; }
    public ExptIterationResult Data { get; set; }
    public string Error { get; set; }
}

public class ExptIterationResult
{
    public string IterationId { get; set; }
    public string ExptId { get; set; }
    public CustomEventSuccessCriteria CustomEventSuccessCriteria { get; set; }
    public CustomEventTrackOption CustomEventTrackOption { get; set; }
    public string CustomEventUnit { get; set; }
    public DateTime? EndTime { get; set; }
    public int EventType { get; set; }
    public bool IsFinish { get; set; }
    public List<IterationResult> Results { get; set; }
    public DateTime StartTime { get; set; }
}