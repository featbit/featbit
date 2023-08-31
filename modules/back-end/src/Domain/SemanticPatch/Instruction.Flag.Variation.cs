using Domain.FeatureFlags;

namespace Domain.SemanticPatch;

public class AddVariationInstruction : FlagInstruction
{
    public AddVariationInstruction(Variation value) : base(FlagInstructionKind.AddVariation, value)
    {
    }

    public override void Apply(FeatureFlag flag)
    {
        if (Value is Variation variation)
        {
            flag.Variations.Add(variation);
        }
    }
}

public class RemoveVariationInstruction : FlagInstruction
{
    public RemoveVariationInstruction(string value) : base(FlagInstructionKind.RemoveVariation, value)
    {
    }

    public override void Apply(FeatureFlag flag)
    {
        if (Value is not string variationId)
        {
            return;
        }

        var variationToRemove = flag.Variations.FirstOrDefault(v => v.Id == variationId);
        if (variationToRemove != null)
        {
            flag.Variations.Remove(variationToRemove);
        }
    }
}

public class UpdateVariationInstruction : FlagInstruction
{
    public UpdateVariationInstruction(Variation value) : base(FlagInstructionKind.UpdateVariation, value)
    {
    }

    public override void Apply(FeatureFlag flag)
    {
        if (Value is not Variation variationToUpdate)
        {
            return;
        }

        var variation = flag.Variations.FirstOrDefault(v => v.Id == variationToUpdate.Id);
        variation?.Assign(variationToUpdate);
    }
}

public class DisabledVariationInstruction : FlagInstruction
{
    public DisabledVariationInstruction(string value) : base(FlagInstructionKind.UpdateDisabledVariation, value)
    {
    }

    public override void Apply(FeatureFlag flag)
    {
        if (Value is not string variationId)
        {
            return;
        }

        if (flag.Variations.Any(x => x.Id == variationId))
        {
            flag.DisabledVariationId = variationId;
        }
    }
}

public class UpdateDefaultRuleVariationOrRolloutInstruction : FlagInstruction
{
    public UpdateDefaultRuleVariationOrRolloutInstruction(DefaultRuleRolloutVariations value) : base(FlagInstructionKind.UpdateDefaultRuleVariationOrRollouts, value)
    {
    }

    public override void Apply(FeatureFlag flag)
    {
        if (Value is DefaultRuleRolloutVariations value)
        {
            flag.Fallthrough.Variations = value.RolloutVariations;
        }
    }
}

public class VariationTypeInstruction : FlagInstruction
{
    public VariationTypeInstruction(string value) : base(FlagInstructionKind.UpdateVariationType, value)
    {
    }

    public override void Apply(FeatureFlag flag)
    {
        if (Value is not string variationType)
        {
            return;
        }

        if (!VariationTypes.IsDefined(variationType))
        {
            return;
        }

        flag.VariationType = variationType;
    }
}

public class UpdateVariationOrRolloutInstruction : FlagInstruction
{
    public UpdateVariationOrRolloutInstruction(RuleVariations value) : base(FlagInstructionKind.UpdateRuleVariationOrRollouts, value)
    {
    }

    public override void Apply(FeatureFlag flag)
    {
        if (Value is not RuleVariations value)
        {
            return;
        }

        var rule = flag.Rules.FirstOrDefault(r => r.Id == value.RuleId);
        if (rule == null)
        {
            return;
        }

        rule.Variations = value.RolloutVariations;
    }
}