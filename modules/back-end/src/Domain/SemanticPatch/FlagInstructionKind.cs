namespace Domain.SemanticPatch;

public static class FlagInstructionKind
{
    public const string TurnFlagOn = nameof(TurnFlagOn);

    public const string TurnFlagOff = nameof(TurnFlagOff);

    public const string UpdateName = nameof(UpdateName);

    public const string UpdateDescription = nameof(UpdateDescription);

    public const string AddTags = nameof(AddTags);

    public const string RemoveTags = nameof(RemoveTags);

    public const string ArchiveFlag = nameof(ArchiveFlag);

    public const string RestoreFlag = nameof(RestoreFlag);

    public const string AddVariation = nameof(AddVariation);

    public const string RemoveVariation = nameof(RemoveVariation);

    public const string UpdateVariationType = nameof(UpdateVariationType);

    public const string UpdateVariation = nameof(UpdateVariation);

    public const string UpdateDisabledVariation = nameof(UpdateDisabledVariation);

    public const string UpdateDefaultRuleVariationOrRollouts = nameof(UpdateDefaultRuleVariationOrRollouts);

    public const string UpdateDefaultRuleDispatchKey = nameof(UpdateDefaultRuleDispatchKey);
    
    public const string AddTargetUsers = nameof(AddTargetUsers);

    public const string RemoveTargetUsers = nameof(RemoveTargetUsers);

    public const string SetTargetUsers = nameof(SetTargetUsers);

    public const string AddRule = nameof(AddRule);

    public const string RemoveRule = nameof(RemoveRule);

    public const string SetRules = nameof(SetRules);

    public const string UpdateRuleName = nameof(UpdateRuleName);

    public const string UpdateRuleDispatchKey = nameof(UpdateRuleDispatchKey);

    public const string AddRuleConditions = nameof(AddRuleConditions);

    public const string RemoveRuleConditions = nameof(RemoveRuleConditions);

    public const string UpdateRuleCondition = nameof(UpdateRuleCondition);

    public const string AddValuesToRuleCondition = nameof(AddValuesToRuleCondition);

    public const string RemoveValuesFromRuleCondition = nameof(RemoveValuesFromRuleCondition);

    public const string UpdateRuleVariationOrRollouts = nameof(UpdateRuleVariationOrRollouts);

    public const string Noop = nameof(Noop);

    public static readonly string[] All =
    {
        TurnFlagOn,
        TurnFlagOff,
        UpdateName,
        UpdateDescription,
        AddTags,
        RemoveTags,
        ArchiveFlag,
        RestoreFlag,
        AddVariation,
        RemoveVariation,
        UpdateVariationType,
        UpdateVariation,
        UpdateDisabledVariation,
        UpdateDefaultRuleVariationOrRollouts,
        UpdateDefaultRuleDispatchKey,
        AddTargetUsers,
        RemoveTargetUsers,
        SetTargetUsers,
        AddRule,
        RemoveRule,
        SetRules,
        UpdateRuleName,
        UpdateRuleDispatchKey,
        AddRuleConditions,
        RemoveRuleConditions,
        UpdateRuleCondition,
        AddValuesToRuleCondition,
        RemoveValuesFromRuleCondition,
        UpdateRuleVariationOrRollouts,
        Noop
    };

    public static bool IsDefined(string type)
    {
        return All.Contains(type);
    }
}