namespace Domain.FeatureFlags;

public class Insights
{
    public string Time { get; set; }
    public ICollection<VariationInsights> Variations { get; set; }
}

public class VariationInsights
{
    public string Id { get; set; }

    public int Val { get; set; }
}
