using Application.Bases.Models;

namespace Application.FeatureFlags;

public class FeatureFlagFilter : PagedRequest
{
    /// <summary>
    /// The name or part of the name of the feature flag
    /// </summary>
    public string Name { get; set; }

    /// <summary>
    /// The list of tags, you must use the complete name of tags
    /// </summary>
    public string[] Tags { get; set; } = Array.Empty<string>();

    /// <summary>
    /// Return only enabled feature flags if true, and return only disabled feature flags if false.
    /// If you don't provide any value, both enabled and disabled feature flags would be returned.
    /// </summary>
    public bool? IsEnabled { get; set; }

    /// <summary>
    /// Return only archived feature flags if true, the default value is false
    /// </summary>
    public bool IsArchived { get; set; }
}