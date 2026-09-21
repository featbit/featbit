using Application.Bases.Models;

namespace Application.Experiments.ExperimentMetrics;

public class ExperimentMetricFilter : PagedRequest
{
    public string SearchText { get; set; }

    public string Name { get; set; }

    public string Key { get; set; }

    public string Status { get; set; }
}
