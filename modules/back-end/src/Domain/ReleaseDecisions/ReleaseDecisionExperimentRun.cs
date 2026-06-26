namespace Domain.ReleaseDecisions;

public class ReleaseDecisionExperimentRun : AuditedEntity
{
    public Guid ExperimentId { get; set; }

    public string Slug { get; set; }

    public string Status { get; set; } = "draft";

    public string Hypothesis { get; set; }

    public string Method { get; set; }

    public string MethodReason { get; set; }

    public string PrimaryMetricEvent { get; set; }

    public string MetricDescription { get; set; }

    public string GuardrailEvents { get; set; }

    public string GuardrailDescriptions { get; set; }

    public string ControlVariant { get; set; }

    public string TreatmentVariant { get; set; }

    public string TrafficAllocation { get; set; }

    public int? MinimumSample { get; set; }

    public DateTime? ObservationStart { get; set; }

    public DateTime? ObservationEnd { get; set; }

    public bool PriorProper { get; set; }

    public double? PriorMean { get; set; }

    public double? PriorStddev { get; set; }

    public string InputData { get; set; }

    public string AnalysisResult { get; set; }

    public string Decision { get; set; }

    public string DecisionSummary { get; set; }

    public string DecisionReason { get; set; }

    public string WhatChanged { get; set; }

    public string WhatHappened { get; set; }

    public string ConfirmedOrRefuted { get; set; }

    public string WhyItHappened { get; set; }

    public string NextHypothesis { get; set; }

    public string RunId { get; set; }

    public string PrimaryMetricAgg { get; set; } = "once";

    public string PrimaryMetricType { get; set; } = "binary";

    public double? TrafficPercent { get; set; } = 100;

    public string LayerId { get; set; }

    public string AudienceFilters { get; set; }

    public int? TrafficOffset { get; set; } = 0;

    public string LayerKey { get; set; }

    public string AllocationKeySelector { get; set; } = "user.keyId";

    public double? SliceStart { get; set; } = 0;

    public double? SliceEnd { get; set; } = 100;

    public string AllocationPlan { get; set; }

    public string AssignmentUnitSelector { get; set; } = "user.keyId";

    public double? LayerTrafficPercent { get; set; } = 100;

    public string AnalysisSamplingPlan { get; set; }

    public string DataSourceMode { get; set; } = "featbit-managed";

    public string CustomerEndpointConfig { get; set; }

    public ReleaseDecisionExperiment Experiment { get; set; }
}
