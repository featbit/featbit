using Application.Bases.Models;

namespace Application.Experiments;

public class ExperimentMetricFilter : PagedRequest
{
    public string SearchText { get; set; }
}