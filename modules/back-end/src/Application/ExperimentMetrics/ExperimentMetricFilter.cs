using Application.Bases.Models;
using Domain.ExperimentMetrics;

namespace Application.ExperimentMetrics;

public class ExperimentMetricFilter : PagedRequest
{
    public string? metricName { get; set; }
    public EventType? EventType { get; set; }
}