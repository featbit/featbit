namespace Application.ReleaseDecisions;

public class ReleaseDecisionExperimentRunAudienceUpdate
{
    public double? TrafficPercent { get; set; }

    public int? TrafficOffset { get; set; }

    public string LayerId { get; set; }

    public string AudienceFilters { get; set; }

    public string Method { get; set; }
}

public class ReleaseDecisionExperimentRunObservationWindowUpdate
{
    public DateTime? ObservationStart { get; set; }

    public DateTime? ObservationEnd { get; set; }
}

public class ReleaseDecisionExperimentRunUpdate
{
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

    public bool? PriorProper { get; set; }

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
}

public class CreateReleaseDecisionExperimentRun : IRequest<ReleaseDecisionExperimentDetailVm>
{
    public Guid EnvId { get; set; }

    public Guid Id { get; set; }
}

public class DeleteReleaseDecisionExperimentRun : IRequest<ReleaseDecisionExperimentDetailVm>
{
    public Guid EnvId { get; set; }

    public Guid Id { get; set; }

    public Guid RunId { get; set; }
}

public class UpdateReleaseDecisionExperimentRunAudience : IRequest<ReleaseDecisionExperimentDetailVm>
{
    public Guid EnvId { get; set; }

    public Guid Id { get; set; }

    public Guid RunId { get; set; }

    public ReleaseDecisionExperimentRunAudienceUpdate Update { get; set; }
}

public class UpdateReleaseDecisionExperimentRun : IRequest<ReleaseDecisionExperimentDetailVm>
{
    public Guid EnvId { get; set; }

    public Guid Id { get; set; }

    public Guid RunId { get; set; }

    public ReleaseDecisionExperimentRunUpdate Update { get; set; }
}

public class UpdateReleaseDecisionExperimentRunObservationWindow : IRequest<ReleaseDecisionExperimentDetailVm>
{
    public Guid EnvId { get; set; }

    public Guid Id { get; set; }

    public Guid RunId { get; set; }

    public ReleaseDecisionExperimentRunObservationWindowUpdate Update { get; set; }
}

public class CreateReleaseDecisionExperimentRunHandler(
    IReleaseDecisionExperimentService service)
    : IRequestHandler<CreateReleaseDecisionExperimentRun, ReleaseDecisionExperimentDetailVm>
{
    public async Task<ReleaseDecisionExperimentDetailVm> Handle(
        CreateReleaseDecisionExperimentRun request,
        CancellationToken cancellationToken)
    {
        return await service.CreateRunAsync(request.EnvId, request.Id);
    }
}

public class DeleteReleaseDecisionExperimentRunHandler(
    IReleaseDecisionExperimentService service)
    : IRequestHandler<DeleteReleaseDecisionExperimentRun, ReleaseDecisionExperimentDetailVm>
{
    public async Task<ReleaseDecisionExperimentDetailVm> Handle(
        DeleteReleaseDecisionExperimentRun request,
        CancellationToken cancellationToken)
    {
        return await service.DeleteRunAsync(request.EnvId, request.Id, request.RunId);
    }
}

public class UpdateReleaseDecisionExperimentRunAudienceHandler(
    IReleaseDecisionExperimentService service)
    : IRequestHandler<UpdateReleaseDecisionExperimentRunAudience, ReleaseDecisionExperimentDetailVm>
{
    public async Task<ReleaseDecisionExperimentDetailVm> Handle(
        UpdateReleaseDecisionExperimentRunAudience request,
        CancellationToken cancellationToken)
    {
        return await service.UpdateRunAudienceAsync(request.EnvId, request.Id, request.RunId, request.Update);
    }
}

public class UpdateReleaseDecisionExperimentRunHandler(
    IReleaseDecisionExperimentService service)
    : IRequestHandler<UpdateReleaseDecisionExperimentRun, ReleaseDecisionExperimentDetailVm>
{
    public async Task<ReleaseDecisionExperimentDetailVm> Handle(
        UpdateReleaseDecisionExperimentRun request,
        CancellationToken cancellationToken)
    {
        return await service.UpdateRunAsync(request.EnvId, request.Id, request.RunId, request.Update);
    }
}

public class UpdateReleaseDecisionExperimentRunObservationWindowHandler(
    IReleaseDecisionExperimentService service)
    : IRequestHandler<UpdateReleaseDecisionExperimentRunObservationWindow, ReleaseDecisionExperimentDetailVm>
{
    public async Task<ReleaseDecisionExperimentDetailVm> Handle(
        UpdateReleaseDecisionExperimentRunObservationWindow request,
        CancellationToken cancellationToken)
    {
        return await service.UpdateRunObservationWindowAsync(request.EnvId, request.Id, request.RunId, request.Update);
    }
}
