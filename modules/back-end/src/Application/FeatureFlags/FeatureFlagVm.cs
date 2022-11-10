using Domain.FeatureFlags;

namespace Application.FeatureFlags;

public class FeatureFlagVm
{
    public string Id { get; set; }

    public string Name { get; set; }

    public string Key { get; set; }

    public bool IsEnabled { get; set; }

    public string VariationType { get; set; }

    public ICollection<Variation> Variations { get; set; }
    
    public DateTime UpdatedAt { get; set; }

    public Serves Serves { get; set; }

    public ICollection<string> Tags { get; set; }
}