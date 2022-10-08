namespace Application.FeatureFlags;

public class FeatureFlagVm
{
    public string Id { get; set; }

    public string Name { get; set; }

    public string Key { get; set; }

    public bool IsEnabled { get; set; }

    public string VariationType { get; set; }

    public DateTime UpdatedAt { get; set; }
}