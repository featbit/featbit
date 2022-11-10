namespace Domain.FeatureFlags;

public class StatsByVariationParam
{
    public string FlagExptId { get; set; }
    public Guid EnvId { get; set; }
    public long StartTime { get; set; }
    public string IntervalType { get; set; }
    public long EndTime { get; set; }
}

public class StatsByVariationResponse
{
    public int Code { get; set; }
    public ICollection<FeatureFlagStats> Data { get; set; }
    public string Error { get; set; }
}

public class FeatureFlagStats
{
    public string Time { get; set; }
    public ICollection<VariationStats> Variations { get; set; }
}

public class VariationStats
{
    public string Id { get; set; }
    
    public int Val { get; set; }
}
