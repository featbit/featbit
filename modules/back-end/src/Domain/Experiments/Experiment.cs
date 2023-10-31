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
    public double? Alpha { get; set; }
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
    public string ChangeToBaseline { get; set; }
    public List<string> ConfidenceInterval { get; set; }
    public long? Conversion { get; set; }
    public string ConversionRate { get; set; }
    public long? TotalEvents { get; set; }
    public string Average { get; set; }
    public bool IsBaseline { get; set; }
    public bool IsInvalid { get; set; }
    public bool IsWinner { get; set; }
    public string PValue { get; set; }
    public long? UniqueUsers { get; set; }
    public string VariationId { get; set; }
    public string EffectSize { get; set; }
    public string Reason { get; set; }
}

public class ExptIterationParam
{
    public Guid ExptId { get; set; }

    public string IterationId { get; set; }

    public Guid EnvId { get; set; }

    public string FlagExptId { get; set; }

    public string BaselineVariationId { get; set; }

    public IEnumerable<string> VariationIds { get; set; }

    public string EventName { get; set; }

    public int EventType { get; set; }

    public int CustomEventTrackOption { get; set; }

    public int CustomEventSuccessCriteria { get; set; }

    public string CustomEventUnit { get; set; }

    public long StartExptTime { get; set; } // format "1667489884000000"

    public long? EndExptTime { get; set; } // format "1667489884000000"
    public double? Alpha { get; set; }
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
    public double? Alpha { get; set; }
}