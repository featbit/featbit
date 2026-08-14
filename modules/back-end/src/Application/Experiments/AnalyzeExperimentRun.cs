namespace Application.Experiments;

public class ExperimentRunAnalyzeRequest
{
    public bool ForceFresh { get; set; }
}

public class AnalyzeExperimentRun : IRequest<ExperimentDetailVm>
{
    public Guid EnvId { get; set; }

    public Guid Id { get; set; }

    public Guid RunId { get; set; }

    public ExperimentRunAnalyzeRequest Request { get; set; }
}

public class AnalyzeExperimentRunHandler(
    IExperimentService service)
    : IRequestHandler<AnalyzeExperimentRun, ExperimentDetailVm>
{
    public async Task<ExperimentDetailVm> Handle(
        AnalyzeExperimentRun request,
        CancellationToken cancellationToken)
    {
        return await service.AnalyzeRunAsync(
            request.EnvId,
            request.Id,
            request.RunId,
            request.Request);
    }
}
