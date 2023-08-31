using Domain.FeatureFlags;

namespace Domain.SemanticPatch;

public abstract class FlagInstruction : Instruction
{
    protected FlagInstruction(string kind, object value) : base(kind, value)
    {
    }

    public abstract void Apply(FeatureFlag flag);
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