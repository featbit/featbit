using Domain.Experiments;

namespace Application.Experiments;

public class StartExperiment : IRequest<ExperimentIteration>
{
    public Guid EnvId { get; set; }

    public Guid ExperimentId { get; set; }
}

public class StartExperimentHandler : IRequestHandler<StartExperiment, ExperimentIteration>
{
    private readonly IExperimentService _service;

    public StartExperimentHandler(IExperimentService service)
    {
        _service = service;
    }

    public async Task<ExperimentIteration> Handle(StartExperiment request, CancellationToken cancellationToken)
    {
        return await _service.StartAsync(request.EnvId, request.ExperimentId);
    }
}