using Application.Bases.Models;

namespace Application.FeatureFlags;

public class FeatureFlagFilter : PagedRequest
{
    public string Name { get; set; }

    public bool? IsEnabled { get; set; }

    public bool IncludeArchived { get; set; }
}