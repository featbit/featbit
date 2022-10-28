using Domain.Experiments;

namespace Application.Experiments;

public class StopIteration: IRequest<ExperimentIteration>
{
    public Guid EnvId { get; set; }
    public Guid ExperimentId { get; set; }
    public string IterationId { get; set; }
}


public class StopIterationHandler : IRequestHandler<StopIteration, ExperimentIteration>
{
    private readonly IExperimentService _service;

    public StopIterationHandler(IExperimentService service)
    {
        _service = service;
    }

    public async Task<ExperimentIteration> Handle(StopIteration request, CancellationToken cancellationToken)
    {
        return await _service.StopIteration(request.EnvId, request.ExperimentId, request.IterationId);
    }
}