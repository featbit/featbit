using Domain.Experiments;

namespace Application.Experiments;

public class StartIteration: IRequest<ExperimentIteration>
{
    public Guid EnvId { get; set; }
    public Guid ExperimentId { get; set; }
}


public class StartIterationHandler : IRequestHandler<StartIteration, ExperimentIteration>
{
    private readonly IExperimentService _service;

    public StartIterationHandler(IExperimentService service)
    {
        _service = service;
    }

    public async Task<ExperimentIteration> Handle(StartIteration request, CancellationToken cancellationToken)
    {
        return await _service.StartIteration(request.EnvId, request.ExperimentId);
    }
}