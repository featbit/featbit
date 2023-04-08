using Domain.FeatureFlags;

namespace Application.FeatureFlags;

public class FeatureFlagVm
{
    public string Id { get; set; }

    public string Name { get; set; }
    
    public string Description { get; set; }

    public string Key { get; set; }

    public bool IsEnabled { get; set; }

    public string VariationType { get; set; }

    public ICollection<Variation> Variations { get; set; }
    
    public DateTime UpdatedAt { get; set; }

    /// <summary>
    /// The possible variation value(s) that would be returned. 
    /// </summary>
    public Serves Serves { get; set; }

    public ICollection<string> Tags { get; set; }
}