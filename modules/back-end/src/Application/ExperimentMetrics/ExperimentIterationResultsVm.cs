using Domain.Experiments;

namespace Application.ExperimentMetrics;

public class ExperimentIterationResultsVm
{
    public bool IsUpdated { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public List<IterationResult> Results { get; set; }
    public bool IsFinish { get; set; }
}