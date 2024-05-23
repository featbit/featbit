using Domain.Experiments;

namespace Application.Experiments;

public class StopExperiment: IRequest<bool>
{
    public Guid EnvId { get; set; }
    public Guid ExperimentId { get; set; }
}


public class StopExperimentHandler : IRequestHandler<StopExperiment, bool>
{
    private readonly IExperimentService _service;

    public StopExperimentHandler(IExperimentService service)
    {
        _service = service;
    }

    public async Task<bool> Handle(StopExperiment request, CancellationToken cancellationToken)
    {
        await _service.StopExperiment(request.EnvId, request.ExperimentId);
        return true;
    }
}