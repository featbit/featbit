using System.Collections;
using System.Text.Json;
using Domain.FeatureFlags;
using Domain.Targeting;

namespace Domain.SemanticPatch;

public class FlagInstructions : IEnumerable<FlagInstruction>
{
    private readonly IEnumerable<FlagInstruction> _instructions;
    
    private delegate FlagInstruction InstructionCreator(string kind, JsonElement value);
    private static readonly Dictionary<string, InstructionCreator> InstructionCreators = new()
    {
        { FlagInstructionKind.TurnFlagOn, (kind, _) => new StatusInstruction(kind) },
        { FlagInstructionKind.TurnFlagOff, (kind, _) => new StatusInstruction(kind) },
        { FlagInstructionKind.ArchiveFlag, (kind, _) => new ArchiveInstruction(kind) },
        { FlagInstructionKind.RestoreFlag, (kind, _) => new ArchiveInstruction(kind) },
        { FlagInstructionKind.UpdateName, (_, value) => new NameInstruction(value.GetString()) },
        { FlagInstructionKind.UpdateDescription, (_, value) => new DescriptionInstruction(value.GetString()) },
        { FlagInstructionKind.AddTags, (kind, value) => new TagsInstruction(kind, value.Deserialize<ICollection<string>>()) },
        { FlagInstructionKind.RemoveTags, (kind, value) => new TagsInstruction(kind, value.Deserialize<ICollection<string>>()) },
        { FlagInstructionKind.UpdateVariationType, (_, value) => new VariationTypeInstruction(value.GetString()) },
        { FlagInstructionKind.AddVariation, (_, value) => new AddVariationInstruction(value.Deserialize<Variation>(ReusableJsonSerializerOptions.Web)) },
        { FlagInstructionKind.RemoveVariation, (_, value) => new RemoveVariationInstruction(value.GetString()) },
        { FlagInstructionKind.UpdateVariation, (_, value) => new UpdateVariationInstruction(value.Deserialize<Variation>(ReusableJsonSerializerOptions.Web)) },
        { FlagInstructionKind.UpdateDisabledVariation, (_, value) => new DisabledVariationInstruction(value.GetString()) },
        { FlagInstructionKind.UpdateDefaultRuleVariationOrRollouts, (_, value) => new UpdateDefaultRuleVariationOrRolloutInstruction(value.Deserialize<DefaultRuleRolloutVariations>(ReusableJsonSerializerOptions.Web)) },
        { FlagInstructionKind.UpdateDefaultRuleDispatchKey, (_, value) => new UpdateDefaultRuleDispatchKeyInstruction(value.GetString()) },
        { FlagInstructionKind.SetTargetUsers, (kind, value) => new TargetUsersInstruction(kind, value.Deserialize<TargetUser>(ReusableJsonSerializerOptions.Web)) },
        { FlagInstructionKind.AddTargetUsers, (kind, value) => new TargetUsersInstruction(kind, value.Deserialize<TargetUser>(ReusableJsonSerializerOptions.Web)) },
        { FlagInstructionKind.RemoveTargetUsers, (kind, value) => new TargetUsersInstruction(kind, value.Deserialize<TargetUser>(ReusableJsonSerializerOptions.Web)) },
        { FlagInstructionKind.SetRules, (_, value) => new SetRulesInstruction(value.Deserialize<ICollection<TargetRule>>(ReusableJsonSerializerOptions.Web)) },
        { FlagInstructionKind.AddRule, (_, value) => new AddRuleInstruction( value.Deserialize<TargetRule>(ReusableJsonSerializerOptions.Web)) },
        { FlagInstructionKind.RemoveRule, (_, value) => new RemoveRuleInstruction(value.GetString()) },
        { FlagInstructionKind.UpdateRuleName, (_, value) => new RuleNameInstruction(value.Deserialize<RuleName>(ReusableJsonSerializerOptions.Web)) },
        { FlagInstructionKind.UpdateRuleDispatchKey, (_, value) => new RuleDispatchKeyInstruction(value.Deserialize<RuleDispatchKey>(ReusableJsonSerializerOptions.Web)) },
        { FlagInstructionKind.RemoveRuleConditions, (_, value) => new RemoveConditionsInstruction(value.Deserialize<RuleConditionIds>(ReusableJsonSerializerOptions.Web)) },
        { FlagInstructionKind.AddRuleConditions, (_, value) => new AddConditionsInstruction(value.Deserialize<RuleConditions>(ReusableJsonSerializerOptions.Web)) },
        { FlagInstructionKind.UpdateRuleCondition, (_, value) => new UpdateConditionInstruction(value.Deserialize<RuleCondition>(ReusableJsonSerializerOptions.Web)) },
        { FlagInstructionKind.RemoveValuesFromRuleCondition, (kind, value) => new RuleConditionValuesInstruction(kind, value.Deserialize<RuleConditionValues>(ReusableJsonSerializerOptions.Web)) },
        { FlagInstructionKind.AddValuesToRuleCondition, (kind, value) => new RuleConditionValuesInstruction(kind, value.Deserialize<RuleConditionValues>(ReusableJsonSerializerOptions.Web)) },
        { FlagInstructionKind.UpdateRuleVariationOrRollouts, (_, value) => new UpdateVariationOrRolloutInstruction(value.Deserialize<RuleVariations>(ReusableJsonSerializerOptions.Web)) },
    };

    public FlagInstructions(JsonElement json)
    {
        if (json.ValueKind != JsonValueKind.Array)
        {
            _instructions = Array.Empty<FlagInstruction>();
            return;
        }

        var instructions = new List<FlagInstruction>();
        foreach (var jsonElement in json.EnumerateArray())
        {
            if (!jsonElement.TryGetProperty("kind", out var kindElement))
            {
                continue;
            }

            var kind = kindElement.GetString()!;
            if (!InstructionCreators.TryGetValue(kind, out var creator))
            {
                continue;
            }

            JsonElement value = default;
            if (jsonElement.TryGetProperty("value", out var valueElement))
            {
                value = valueElement;
            }

            var instruction = creator.Invoke(kind, value);
            instructions.Add(instruction);
        }

        _instructions = instructions;
    }

    public IEnumerator<FlagInstruction> GetEnumerator()
    {
        return _instructions.GetEnumerator();
    }

    IEnumerator IEnumerable.GetEnumerator()
    {
        return GetEnumerator();
    }
}