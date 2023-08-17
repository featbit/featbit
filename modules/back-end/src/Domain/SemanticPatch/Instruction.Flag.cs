using Domain.FeatureFlags;

namespace Domain.SemanticPatch;

public abstract class FlagInstruction : Instruction
{
    protected FlagInstruction(string kind, object value) : base(kind, value)
    {
    }

    public abstract void Apply(FeatureFlag flag);
}