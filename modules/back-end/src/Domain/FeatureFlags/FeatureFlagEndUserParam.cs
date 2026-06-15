namespace Domain.FeatureFlags;

public class FeatureFlagEndUserParam
{
    public Guid EnvId { get; set; }

    public string FeatureFlagKey { get; set; }

    public string VariationId { get; set; }
    public string Query { get; set; }
    public long StartTime { get; set; }
    
    public long EndTime { get; set; }
    public int PageIndex { get; set; }
    public int PageSize { get; set; }
}

public class FeatureFlagEndUserStats
{
    public int TotalCount { get; set; }
    public ICollection<FeatureFlagEndUser> Items { get; set; }
}

public class FeatureFlagEndUser
{
    public string VariationId { get; set; }
    public string KeyId { get; set; }
    public string Name { get; set; }
    public string LastEvaluatedAt { get; set; }
}
