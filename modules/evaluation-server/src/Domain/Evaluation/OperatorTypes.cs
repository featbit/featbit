namespace Domain.Evaluation;

public class OperatorTypes
{
    // numeric
    public const string LessThan = "LessThan";
    public const string BiggerThan = "BiggerThan";
    public const string LessEqualThan = "LessEqualThan";
    public const string BiggerEqualThan = "BiggerEqualThan";

    // compare
    public const string Equal = "Equal";
    public const string NotEqual = "NotEqual";

    // contains/not contains
    public const string Contains = "Contains";
    public const string NotContain = "NotContain";

    // starts with/ends with
    public const string StartsWith = "StartsWith";
    public const string EndsWith = "EndsWith";

    // match regex/not match regex
    public const string MatchRegex = "MatchRegex";
    public const string NotMatchRegex = "NotMatchRegex";

    // is one of/ not one of
    public const string IsOneOf = "IsOneOf";
    public const string NotOneOf = "NotOneOf";

    // is true/ is false
    public const string IsTrue = "IsTrue";
    public const string IsFalse = "IsFalse";
}