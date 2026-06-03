namespace Application.ReleaseDecisions;

public class ReleaseDecisionMetricsUpdate
{
    public string MetricName { get; set; }

    public string MetricEvent { get; set; }

    public string MetricType { get; set; } = "binary";

    public string MetricAgg { get; set; } = "once";

    public string MetricDescription { get; set; }

    public string Guardrails { get; set; }
}

public class UpdateReleaseDecisionMetrics : IRequest<ReleaseDecisionExperimentDetailVm>
{
    public Guid EnvId { get; set; }

    public Guid Id { get; set; }

    public ReleaseDecisionMetricsUpdate Update { get; set; }
}

public class UpdateReleaseDecisionMetricsHandler(
    IReleaseDecisionExperimentService service)
    : IRequestHandler<UpdateReleaseDecisionMetrics, ReleaseDecisionExperimentDetailVm>
{
    public async Task<ReleaseDecisionExperimentDetailVm> Handle(
        UpdateReleaseDecisionMetrics request,
        CancellationToken cancellationToken)
    {
        return await service.UpdateMetricsAsync(request.EnvId, request.Id, request.Update);
    }
}
