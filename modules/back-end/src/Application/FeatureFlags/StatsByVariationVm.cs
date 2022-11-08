namespace Application.FeatureFlags;

public class StatsByVariationVm
{
    public long Time { get; set; }
    public IEnumerable<VariationStatsVm> Variations { get; set; }
}

public class VariationStatsVm
{
    public string Id { get; set; }
    public string Value { get; set; }
    public int Count { get; set; }
}