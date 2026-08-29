namespace Application.Experiments;

public class ExperimentRunAudienceUpdate
{
    public double? TrafficPercent { get; set; }

    public int? TrafficOffset { get; set; }

    public string LayerId { get; set; }

    public string AudienceFilters { get; set; }

    public string Method { get; set; }

    public string ControlVariant { get; set; }

    public string TreatmentVariant { get; set; }

    public string LayerKey { get; set; }

    public string AllocationKeySelector { get; set; }

    public double? SliceStart { get; set; }

    public double? SliceEnd { get; set; }

    public string AllocationPlan { get; set; }

    public string AssignmentUnitSelector { get; set; }

    public double? LayerTrafficPercent { get; set; }

    public string AnalysisSamplingPlan { get; set; }
}

public class ExperimentRunObservationWindowUpdate
{
    public DateTime? ObservationStart { get; set; }

    public DateTime? ObservationEnd { get; set; }
}

public class ExperimentRunUpdate
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

    public string PrimaryMetricAgg { get; set; }

    public string PrimaryMetricType { get; set; }

    public double? TrafficPercent { get; set; }

    public string LayerId { get; set; }

    public string AudienceFilters { get; set; }

    public int? TrafficOffset { get; set; }

    public string LayerKey { get; set; }

    public string AllocationKeySelector { get; set; }

    public double? SliceStart { get; set; }

    public double? SliceEnd { get; set; }

    public string AllocationPlan { get; set; }

    public string AssignmentUnitSelector { get; set; }

    public double? LayerTrafficPercent { get; set; }

    public string AnalysisSamplingPlan { get; set; }

    public string DataSourceMode { get; set; }

    public string CustomerEndpointConfig { get; set; }
}

public class CreateExperimentRun : IRequest<ExperimentDetailVm>
{
    public Guid EnvId { get; set; }

    public Guid Id { get; set; }
}

public class DeleteExperimentRun : IRequest<ExperimentDetailVm>
{
    public Guid EnvId { get; set; }

    public Guid Id { get; set; }

    public Guid RunId { get; set; }
}

public class UpdateExperimentRunAudience : IRequest<ExperimentDetailVm>
{
    public Guid EnvId { get; set; }

    public Guid Id { get; set; }

    public Guid RunId { get; set; }

    public ExperimentRunAudienceUpdate Update { get; set; }
}

public class UpdateExperimentRun : IRequest<ExperimentDetailVm>
{
    public Guid EnvId { get; set; }

    public Guid Id { get; set; }

    public Guid RunId { get; set; }

    public ExperimentRunUpdate Update { get; set; }
}

public class UpdateExperimentRunObservationWindow : IRequest<ExperimentDetailVm>
{
    public Guid EnvId { get; set; }

    public Guid Id { get; set; }

    public Guid RunId { get; set; }

    public ExperimentRunObservationWindowUpdate Update { get; set; }
}

public class CreateExperimentRunHandler(
    IExperimentService service)
    : IRequestHandler<CreateExperimentRun, ExperimentDetailVm>
{
    public async Task<ExperimentDetailVm> Handle(
        CreateExperimentRun request,
        CancellationToken cancellationToken)
    {
        return await service.CreateRunAsync(request.EnvId, request.Id);
    }
}

public class DeleteExperimentRunHandler(
    IExperimentService service)
    : IRequestHandler<DeleteExperimentRun, ExperimentDetailVm>
{
    public async Task<ExperimentDetailVm> Handle(
        DeleteExperimentRun request,
        CancellationToken cancellationToken)
    {
        return await service.DeleteRunAsync(request.EnvId, request.Id, request.RunId);
    }
}

public class UpdateExperimentRunAudienceHandler(
    IExperimentService service)
    : IRequestHandler<UpdateExperimentRunAudience, ExperimentDetailVm>
{
    public async Task<ExperimentDetailVm> Handle(
        UpdateExperimentRunAudience request,
        CancellationToken cancellationToken)
    {
        return await service.UpdateRunAudienceAsync(request.EnvId, request.Id, request.RunId, request.Update);
    }
}

public class UpdateExperimentRunHandler(
    IExperimentService service)
    : IRequestHandler<UpdateExperimentRun, ExperimentDetailVm>
{
    public async Task<ExperimentDetailVm> Handle(
        UpdateExperimentRun request,
        CancellationToken cancellationToken)
    {
        return await service.UpdateRunAsync(request.EnvId, request.Id, request.RunId, request.Update);
    }
}

public class UpdateExperimentRunObservationWindowHandler(
    IExperimentService service)
    : IRequestHandler<UpdateExperimentRunObservationWindow, ExperimentDetailVm>
{
    public async Task<ExperimentDetailVm> Handle(
        UpdateExperimentRunObservationWindow request,
        CancellationToken cancellationToken)
    {
        return await service.UpdateRunObservationWindowAsync(request.EnvId, request.Id, request.RunId, request.Update);
    }
}
