namespace Application.ReleaseDecisions;

public class ReleaseDecisionExperimentRunAnalyzeRequest
{
    public bool ForceFresh { get; set; }
}

public class AnalyzeReleaseDecisionExperimentRun : IRequest<ReleaseDecisionExperimentDetailVm>
{
    public Guid EnvId { get; set; }

    public Guid Id { get; set; }

    public Guid RunId { get; set; }

    public ReleaseDecisionExperimentRunAnalyzeRequest Request { get; set; }
}

public class AnalyzeReleaseDecisionExperimentRunHandler(
    IReleaseDecisionExperimentService service)
    : IRequestHandler<AnalyzeReleaseDecisionExperimentRun, ReleaseDecisionExperimentDetailVm>
{
    public async Task<ReleaseDecisionExperimentDetailVm> Handle(
        AnalyzeReleaseDecisionExperimentRun request,
        CancellationToken cancellationToken)
    {
        return await service.AnalyzeRunAsync(
            request.EnvId,
            request.Id,
            request.RunId,
            request.Request);
    }
}
