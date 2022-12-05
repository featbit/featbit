namespace Domain.FeatureFlags;

public class InsightsParam
{
    public string FlagExptId { get; set; }
    public Guid EnvId { get; set; }
    public long StartTime { get; set; }
    public string IntervalType { get; set; }
    public long EndTime { get; set; }
}

public class InsightsResponse
{
    public int Code { get; set; }
    public ICollection<Insights> Data { get; set; }
    public string Error { get; set; }
}

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
