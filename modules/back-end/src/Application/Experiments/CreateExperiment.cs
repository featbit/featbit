using Domain.Experiments;

namespace Application.Experiments;

public class CreateExperiment: IRequest<Experiment>
{
    public Guid EnvId { get; set; }
    public Guid FeatureFlagId { get; set; }
    public Guid MetricId { get; set; }
    public string BaseLineVariationId { get; set; }
    public double? Alpha { get; set; }

    public Experiment AsExperiment()
    {
        return new Experiment
        {
            EnvId = EnvId,
            MetricId = MetricId,
            FeatureFlagId = FeatureFlagId,
            BaselineVariationId = BaseLineVariationId,
            Status = ExperimentStatus.NotStarted,
            Iterations = new List<ExperimentIteration>(),
            Alpha = Alpha ?? 0.05
        };
    }
}

public class CreateExperimentHandler : IRequestHandler<CreateExperiment, Experiment>
{
    private readonly IExperimentService _service;

    public CreateExperimentHandler(IExperimentService service)
    {
        _service = service;
    }

    public async Task<Experiment> Handle(CreateExperiment request, CancellationToken cancellationToken)
    {
        var experiment = request.AsExperiment();
        var existingExperiment = await _service.FindOneAsync(expt =>
            expt.FeatureFlagId == experiment.FeatureFlagId && expt.MetricId == experiment.MetricId && !expt.IsArchived);

        if (existingExperiment == null)
        {
            await _service.AddOneAsync(experiment);
        }
        
        return experiment;
    }
}