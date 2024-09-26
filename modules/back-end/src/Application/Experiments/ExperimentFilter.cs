using Application.Bases.Models;

namespace Application.Experiments;

public class ExperimentFilter : PagedRequest
{
    public string? FeatureFlagName { get; set; }
    public Guid? FeatureFlagId { get; set; }
}