namespace Domain.Targeting;

public static class OperatorTypes
{
    // semantic versions
    public const string SemVerIsOneOf = "SemVerIsOneOf";
    public const string SemVerNotOneOf = "SemVerNotOneOf";
    public const string SemVerLessThan = "SemVerLessThan";
    public const string SemVerLessEqualThan = "SemVerLessEqualThan";
    public const string SemVerBiggerThan = "SemVerBiggerThan";
    public const string SemVerBiggerEqualThan = "SemVerBiggerEqualThan";

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

    public static readonly string[] All =
    [
        SemVerIsOneOf,
        SemVerNotOneOf,
        SemVerLessThan,
        SemVerLessEqualThan,
        SemVerBiggerThan,
        SemVerBiggerEqualThan,
        LessThan,
        BiggerThan,
        LessEqualThan,
        BiggerEqualThan,

        Equal,
        NotEqual,

        Contains,
        NotContain,

        StartsWith,
        EndsWith,

        MatchRegex,
        NotMatchRegex,

        IsOneOf,
        NotOneOf,

        IsTrue,
        IsFalse
    ];

    public static bool IsSemVer(string op) => op is SemVerIsOneOf or SemVerNotOneOf or SemVerLessThan or SemVerLessEqualThan or SemVerBiggerThan or SemVerBiggerEqualThan;

    public static bool IsMultiValue(string op) => op is IsOneOf or NotOneOf or SemVerIsOneOf or SemVerNotOneOf;

    public static bool IsDefined(string op) => All.Contains(op);
}
