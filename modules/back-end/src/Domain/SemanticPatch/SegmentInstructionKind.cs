namespace Domain.SemanticPatch;

public static class SegmentInstructionKind
{
    public const string Archive = nameof(Archive);

    public const string Restore = nameof(Restore);

    public const string UpdateName = nameof(UpdateName);

    public const string UpdateDescription = nameof(UpdateDescription);

    public const string AddRule = nameof(AddRule);

    public const string RemoveRule = nameof(RemoveRule);

    public const string SetRules = nameof(SetRules);

    public const string UpdateRuleName = nameof(UpdateRuleName);

    public const string AddRuleConditions = nameof(AddRuleConditions);

    public const string RemoveRuleConditions = nameof(RemoveRuleConditions);

    public const string UpdateRuleCondition = nameof(UpdateRuleCondition);

    public const string AddValuesToRuleCondition = nameof(AddValuesToRuleCondition);

    public const string RemoveValuesFromRuleCondition = nameof(RemoveValuesFromRuleCondition);

    public const string AddTargetUsersToIncluded = nameof(AddTargetUsersToIncluded);

    public const string RemoveTargetUsersFromIncluded = nameof(RemoveTargetUsersFromIncluded);

    public const string AddTargetUsersToExcluded = nameof(AddTargetUsersToExcluded);

    public const string RemoveTargetUsersFromExcluded = nameof(RemoveTargetUsersFromExcluded);

    public const string Noop = nameof(Noop);

    public static readonly string[] All =
    {
        Archive,
        Restore,
        UpdateName,
        UpdateDescription,
        AddRule,
        RemoveRule,
        SetRules,
        UpdateRuleName,
        AddRuleConditions,
        RemoveRuleConditions,
        UpdateRuleCondition,
        AddValuesToRuleCondition,
        RemoveValuesFromRuleCondition,
        AddTargetUsersToIncluded,
        RemoveTargetUsersFromIncluded,
        AddTargetUsersToExcluded,
        RemoveTargetUsersFromExcluded,
        Noop
    };

    public static bool IsDefined(string type)
    {
        return All.Contains(type);
    }
}