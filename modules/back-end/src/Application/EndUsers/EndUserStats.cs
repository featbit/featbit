using Application.Bases.Models;

namespace Application.EndUsers;

public class EndUserStats
{
    public int TotalCount { get; set; }
    public ICollection<EndUserStatsItem> Items { get; set; }
}

public class EndUserStatsItem
{
    public string VariationId { get; set; }
    public string KeyId { get; set; }
    public string Name { get; set; }
    public string LastEvaluatedAt { get; set; }
}

public class EndUserStatsVm
{
    public string Variation { get; set; }
    public string KeyId { get; set; }
    public string Name { get; set; }
    public string LastEvaluatedAt { get; set; }
}

public class EndUserStatsFilter : PagedRequest
{
    public string FeatureFlagKey { get; set; }
    public string VariationId { get; set; }
    public string Query { get; set; }
    public long From { get; set; }
    public long To { get; set; }
}
