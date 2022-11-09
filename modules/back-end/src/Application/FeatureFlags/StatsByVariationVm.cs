namespace Application.FeatureFlags;

public class StatsByVariationVm
{
    public string Time { get; set; }
    public IEnumerable<VariationStatsVm> Variations { get; set; }
}

public class VariationStatsVm
{
    public string Variation { get; set; }
    public int Count { get; set; }
}