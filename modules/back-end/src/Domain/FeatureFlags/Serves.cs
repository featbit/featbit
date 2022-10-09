namespace Domain.FeatureFlags;

public class Serves
{
    public IEnumerable<string> EnabledVariations { get; set; }

    public string DisabledVariation { get; set; }
}