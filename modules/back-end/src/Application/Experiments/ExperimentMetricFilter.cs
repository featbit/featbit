using Application.Bases.Models;

namespace Application.Experiments;

public class ExperimentMetricFilter : PagedRequest
{
    public string Name { get; set; }
}