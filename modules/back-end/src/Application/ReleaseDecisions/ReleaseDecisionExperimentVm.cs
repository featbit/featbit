using Application.Bases.Models;

namespace Application.ReleaseDecisions;

public class ReleaseDecisionExperimentFilter
{
    public string Name { get; set; }

    public string Stage { get; set; }

    public string FlagKey { get; set; }

    public int PageIndex { get; set; }

    public int PageSize { get; set; } = 10;
}

public class ReleaseDecisionExperimentVm
{
    public Guid Id { get; set; }

    public string Name { get; set; }

    public string Description { get; set; }

    public string Stage { get; set; }

    public string FlagKey { get; set; }

    public string FeatBitProjectKey { get; set; }

    public Guid? FeatBitEnvId { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }
}

public class ReleaseDecisionExperimentDetailVm : ReleaseDecisionExperimentVm
{
    public string Hypothesis { get; set; }

    public string AccessToken { get; set; }

    public string Change { get; set; }

    public string Constraints { get; set; }

    public string EnvSecret { get; set; }

    public string FlagServerUrl { get; set; }

    public string Goal { get; set; }

    public string Guardrails { get; set; }

    public string Intent { get; set; }

    public string LastAction { get; set; }

    public string LastLearning { get; set; }

    public string OpenQuestions { get; set; }

    public string PrimaryMetric { get; set; }

    public string SandboxStatus { get; set; }

    public string SandboxId { get; set; }

    public string Variants { get; set; }

    public string ConflictAnalysis { get; set; }

    public string EntryMode { get; set; }

    public ICollection<ReleaseDecisionExperimentRunVm> ExperimentRuns { get; set; } = [];

    public ICollection<ReleaseDecisionActivityVm> Activities { get; set; } = [];

    public ICollection<ReleaseDecisionMessageVm> Messages { get; set; } = [];
}

public class ReleaseDecisionExperimentRunVm
{
    public Guid Id { get; set; }

    public Guid ExperimentId { get; set; }

    public string Slug { get; set; }

    public string Status { get; set; }

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

    public string PrimaryMetricAgg { get; set; }

    public string PrimaryMetricType { get; set; }

    public double? TrafficPercent { get; set; }

    public string LayerId { get; set; }

    public string AudienceFilters { get; set; }

    public int? TrafficOffset { get; set; }

    public string DataSourceMode { get; set; }

    public string CustomerEndpointConfig { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }
}

public class ReleaseDecisionActivityVm
{
    public Guid Id { get; set; }

    public string Type { get; set; }

    public string Title { get; set; }

    public string Detail { get; set; }

    public DateTime CreatedAt { get; set; }
}

public class ReleaseDecisionMessageVm
{
    public Guid Id { get; set; }

    public string Role { get; set; }

    public string Content { get; set; }

    public string Metadata { get; set; }

    public DateTime CreatedAt { get; set; }
}

public class QueryReleaseDecisionExperiments : IRequest<PagedResult<ReleaseDecisionExperimentVm>>
{
    public Guid EnvId { get; set; }

    public ReleaseDecisionExperimentFilter Filter { get; set; }
}

public class GetReleaseDecisionExperiment : IRequest<ReleaseDecisionExperimentDetailVm>
{
    public Guid EnvId { get; set; }

    public Guid Id { get; set; }
}

public class QueryReleaseDecisionExperimentsHandler(
    IReleaseDecisionExperimentService service)
    : IRequestHandler<QueryReleaseDecisionExperiments, PagedResult<ReleaseDecisionExperimentVm>>
{
    public async Task<PagedResult<ReleaseDecisionExperimentVm>> Handle(
        QueryReleaseDecisionExperiments request,
        CancellationToken cancellationToken)
    {
        return await service.GetListAsync(request.EnvId, request.Filter);
    }
}

public class GetReleaseDecisionExperimentHandler(
    IReleaseDecisionExperimentService service)
    : IRequestHandler<GetReleaseDecisionExperiment, ReleaseDecisionExperimentDetailVm>
{
    public async Task<ReleaseDecisionExperimentDetailVm> Handle(
        GetReleaseDecisionExperiment request,
        CancellationToken cancellationToken)
    {
        return await service.GetAsync(request.EnvId, request.Id);
    }
}
