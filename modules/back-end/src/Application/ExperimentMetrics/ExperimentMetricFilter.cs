using Application.Bases.Models;

namespace Application.ExperimentMetrics;

public class ExperimentMetricFilter : PagedRequest
{
    public string Name { get; set; }
}