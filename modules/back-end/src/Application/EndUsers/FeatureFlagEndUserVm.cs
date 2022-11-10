namespace Application.EndUsers;

public class FeatureFlagEndUserStatsVm
{
    public Guid Id { get; set; }
    public string Variation { get; set; }
    public string KeyId { get; set; }
    public string Name { get; set; }
    public string LastEvaluatedAt { get; set; }
}