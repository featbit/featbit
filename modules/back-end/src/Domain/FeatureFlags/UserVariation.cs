namespace Domain.FeatureFlags;

public class UserVariation
{
    public Variation Variation { get; set; }

    public string MatchReason { get; set; }

    public UserVariation(Variation variation, string matchReason)
    {
        Variation = variation;
        MatchReason = matchReason;
    }
}