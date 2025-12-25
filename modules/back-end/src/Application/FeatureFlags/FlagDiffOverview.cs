using Domain.FeatureFlags;

namespace Application.FeatureFlags;

public class FlagDiffOverview
{
    public Guid TargetEnvId { get; set; }

    public bool OnOffState { get; set; }

    public bool IndividualTargeting { get; set; }

    public bool TargetingRule { get; set; }

    public bool DefaultRule { get; set; }

    public bool OffVariation { get; set; }

    public FlagDiffOverview(Guid targetEnvId, FlagDiff diff)
    {
        TargetEnvId = targetEnvId;
        OnOffState = diff.OnOffState.IsDifferent;
        IndividualTargeting = diff.IndividualTargeting.Any(x => x.IsDifferent);
        TargetingRule = diff.TargetingRule.Any(x => x.IsDifferent);
        DefaultRule = diff.DefaultRule.IsDifferent;
        OffVariation = diff.OffVariation.IsDifferent;
    }
}