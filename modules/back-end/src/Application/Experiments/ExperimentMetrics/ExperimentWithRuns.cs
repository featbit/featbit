using Domain.Experiments;

namespace Application.Experiments.ExperimentMetrics;

public class ExperimentWithRuns
{
    public Experiment Experiment { get; init; }

    public IReadOnlyCollection<ExperimentRun> Runs { get; init; } = [];
}
