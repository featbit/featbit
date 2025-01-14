namespace Application.FeatureFlags;

public class CopyToEnvPrecheckResult
{
    public Guid Id { get; set; }

    public bool KeyCheck { get; set; }

    public bool TargetUserCheck { get; set; }

    public bool TargetRuleCheck { get; set; }

    public bool Passed => KeyCheck && TargetUserCheck && TargetRuleCheck;
}