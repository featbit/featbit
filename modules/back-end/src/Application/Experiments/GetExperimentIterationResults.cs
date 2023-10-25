using Application.ExperimentMetrics;
using Domain.ExperimentMetrics;
using Domain.Experiments;

namespace Application.Experiments;

public class GetExperimentIterationResults: IRequest<IEnumerable<ExperimentIterationResultsVm>>
{
    public Guid EnvId { get; set; }
    public IEnumerable<ExperimentIterationParam> ExperimentIterationParam { get; set; }
}

public class ExperimentIterationParam
{
    public Guid ExptId { get; set; }
    public string IterationId { get; set; }
    public string FlagExptId { get; set; }
    public string BaselineVariationId { get; set; }
    public IEnumerable<string> VariationIds { get; set; }
    public string EventName { get; set; }
    public int EventType { get; set; }
    public CustomEventTrackOption CustomEventTrackOption { get; set; }
    public CustomEventSuccessCriteria CustomEventSuccessCriteria { get; set; }
    public string CustomEventUnit { get; set; }
    public long StartTime { get; set; }
    public long? EndTime { get; set; }
    public bool IsFinish { get; set; }
}

public class GetExperimentIterationResultsHandler : IRequestHandler<GetExperimentIterationResults, IEnumerable<ExperimentIterationResultsVm>>
{
    private readonly IExperimentService _service;

    public GetExperimentIterationResultsHandler(IExperimentService service)
    {
        _service = service;
    }

    public async Task<IEnumerable<ExperimentIterationResultsVm>> Handle(GetExperimentIterationResults request, CancellationToken cancellationToken)
    {
        return await _service.GetIterationResults(request.EnvId, request.ExperimentIterationParam);
    }
}