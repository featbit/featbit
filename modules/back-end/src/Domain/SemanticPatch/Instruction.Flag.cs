using System.Text.Json.Serialization;
using Domain.FeatureFlags;
using Domain.Policies;

namespace Domain.SemanticPatch;

public abstract class FlagInstruction : Instruction
{
    protected FlagInstruction(string kind, object value) : base(kind, value)
    {
    }

    public abstract void Apply(FeatureFlag flag);

    [JsonIgnore]
    public string Permission
    {
        get
        {
            return Kind switch
            {
                FlagInstructionKind.TurnFlagOn or FlagInstructionKind.TurnFlagOff => Permissions.ToggleFlag,
                FlagInstructionKind.UpdateName => Permissions.UpdateFlagName,
                FlagInstructionKind.UpdateDescription => Permissions.UpdateFlagDescription,
                FlagInstructionKind.AddTags or FlagInstructionKind.RemoveTags => Permissions.UpdateFlagTags,
                FlagInstructionKind.ArchiveFlag => Permissions.ArchiveFlag,
                FlagInstructionKind.RestoreFlag => Permissions.RestoreFlag,
                FlagInstructionKind.UpdateDisabledVariation => Permissions.UpdateFlagOffVariation,

                var kind when FlagInstructionKind.UpdateVariationKinds.Contains(kind) => Permissions.UpdateFlagVariations,
                var kind when FlagInstructionKind.UpdateDefaultRuleKinds.Contains(kind) => Permissions.UpdateFlagDefaultRule,
                var kind when FlagInstructionKind.UpdateTargetUsersKinds.Contains(kind) => Permissions.UpdateFlagIndividualTargeting,
                var kind when FlagInstructionKind.UpdateRuleKinds.Contains(kind) => Permissions.UpdateFlagTargetingRules,

                _ => string.Empty
            };
        }
    }
}

public class NoopFlagInstruction : FlagInstruction
{
    public NoopFlagInstruction() : base(FlagInstructionKind.Noop, string.Empty)
    {
    }

    public override void Apply(FeatureFlag flag)
    {
    }

    public static readonly NoopFlagInstruction Instance = new();
}