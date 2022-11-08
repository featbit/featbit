using Application.Bases.Models;

namespace Application.FeatureFlags;

public class FeatureFlagFilter : PagedRequest
{
    public string Name { get; set; }

    public string[] Tags { get; set; } = Array.Empty<string>();

    public bool? IsEnabled { get; set; }

    public bool IsArchived { get; set; }
}