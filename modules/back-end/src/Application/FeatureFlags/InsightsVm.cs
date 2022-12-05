namespace Application.FeatureFlags;

public class InsightsVm
{
    public string Time { get; set; }
    public IEnumerable<VariationInsightsVm> Variations { get; set; }
}

public class VariationInsightsVm
{
    public string Variation { get; set; }
    public int Count { get; set; }
}