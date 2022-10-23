namespace Domain.Core;

public abstract class UserVariation
{
    public abstract bool SendToExperiment { get; }

    public Variation Variation { get; set; }

    public string MatchReason { get; set; }

    protected UserVariation(Variation variation, string matchReason)
    {
        Variation = variation;
        MatchReason = matchReason;
    }
}

public sealed class DefaultUserVariation : UserVariation
{
    public override bool SendToExperiment => true;

    public DefaultUserVariation(Variation variation) : base(variation, "default")
    {
    }
}