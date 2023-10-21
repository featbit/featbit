using Domain.FeatureFlags;
using Domain.Targeting;

namespace Application.FeatureFlags;

public class FlagTargeting
{
    public ICollection<TargetUser> TargetUsers { get; set; }

    public ICollection<TargetRule> Rules { get; set; }

    public Fallthrough Fallthrough { get; set; }

    public bool ExptIncludeAllTargets { get; set; }
}