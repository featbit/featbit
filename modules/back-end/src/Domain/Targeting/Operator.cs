using System.Globalization;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace Domain.Targeting;

public class Operator
{
    private string Operation { get; }
    private Func<string, string, bool> Func { get; }

    private Operator(string operation, Func<string, string, bool> func)
    {
        Operation = operation;
        Func = func;
    }

    public bool IsMatch(string userValue, string conditionValue)
    {
        if (userValue == null || conditionValue == null)
        {
            return false;
        }

        return Func(userValue, conditionValue);
    }

    #region numeric (rule value is a number)

    public static readonly Operator LessThan =
        new(OperatorTypes.LessThan, NumericOperator(-1, -1));

    public static readonly Operator LessEqualThan =
        new(OperatorTypes.LessEqualThan, NumericOperator(-1, 0));

    public static readonly Operator BiggerThan =
        new(OperatorTypes.BiggerThan, NumericOperator(1, 1));

    public static readonly Operator BiggerEqualThan =
        new(OperatorTypes.BiggerEqualThan, NumericOperator(1, 0));

    private static Func<string, string, bool> NumericOperator(
        int desiredComparisonResult,
        int otherDesiredComparisonResult
    ) => (userValue, ruleValue) =>
    {
        // not a number, return false
        if (!TryParseFiniteNumber(userValue, out var userDoubleValue) ||
            !TryParseFiniteNumber(ruleValue, out var ruleDoubleValue))
        {
            return false;
        }

        var result = userDoubleValue.CompareTo(ruleDoubleValue);
        return result == desiredComparisonResult || result == otherDesiredComparisonResult;
    };

    private static bool TryParseFiniteNumber(string value, out double number) =>
        double.TryParse(value, NumberStyles.Float, CultureInfo.InvariantCulture, out number) &&
        double.IsFinite(number);

    #endregion

    #region string compare (rule value is a string)

    public static readonly Operator Equal = new(
        OperatorTypes.Equal,
        (userValue, ruleValue) => string.Equals(userValue, ruleValue, StringComparison.Ordinal)
    );

    public static readonly Operator NotEqual = new(
        OperatorTypes.NotEqual,
        (userValue, ruleValue) => !string.Equals(userValue, ruleValue, StringComparison.Ordinal)
    );

    #endregion

    #region string contains/not contains (rule value is a string)

    public static readonly Operator Contains =
        new(OperatorTypes.Contains, (userValue, ruleValue) => userValue.Contains(ruleValue));

    public static readonly Operator NotContains =
        new(OperatorTypes.NotContain, (userValue, ruleValue) => !userValue.Contains(ruleValue));

    #endregion

    #region string starts with/ends with (rule value is a string)

    public static readonly Operator StartsWith =
        new(OperatorTypes.StartsWith, (userValue, ruleValue) => userValue.StartsWith(ruleValue));

    public static readonly Operator EndsWith =
        new(OperatorTypes.EndsWith, (userValue, ruleValue) => userValue.EndsWith(ruleValue));

    #endregion

    #region string match regex (rule value is a regex)

    public static readonly Operator MatchRegex = new(OperatorTypes.MatchRegex, Regex.IsMatch);

    public static readonly Operator NotMatchRegex =
        new(OperatorTypes.NotMatchRegex, (userValue, ruleValue) => !Regex.IsMatch(userValue, ruleValue));

    #endregion

    #region is one of/ not one of (rule value is a list of strings)

    public static readonly Operator IsOneOf =
        new(OperatorTypes.IsOneOf, (userValue, ruleValue) =>
        {
            var ruleValues = JsonSerializer.Deserialize<List<string>>(ruleValue);

            return ruleValues?.Contains(userValue) ?? false;
        });

    public static readonly Operator NotOneOf =
        new(OperatorTypes.NotOneOf, (userValue, ruleValue) =>
        {
            var ruleValues = JsonSerializer.Deserialize<List<string>>(ruleValue);

            return !ruleValues?.Contains(userValue) ?? true;
        });

    #endregion

    #region is true/ is false (no rule value)

    public static readonly Operator IsTrue = new(
        OperatorTypes.IsTrue,
        (userValue, _) => userValue.Equals("TRUE", StringComparison.OrdinalIgnoreCase)
    );

    public static readonly Operator IsFalse = new(
        OperatorTypes.IsFalse,
        (userValue, _) => userValue.Equals("FALSE", StringComparison.OrdinalIgnoreCase)
    );

    #endregion

    public static IEnumerable<Operator> All => new[]
    {
        // numeric
        LessThan, LessEqualThan, BiggerThan, BiggerEqualThan,

        // string compare
        Equal, NotEqual,

        // string contains/not contains
        Contains, NotContains,

        // string starts with/ends with
        StartsWith, EndsWith,

        // string match regex/not match regex
        MatchRegex, NotMatchRegex,

        // is one of/ not one of
        IsOneOf, NotOneOf,

        // is true/ is false
        IsTrue, IsFalse
    };

    /// <summary>
    /// Checks whether the user's version matches a SemVer rule condition.
    /// </summary>
    /// <param name="op">The SemVer operator.</param>
    /// <param name="userValue">The version from the user's attribute.</param>
    /// <param name="ruleValue">
    /// A JSON array of version strings for IsOneOf/NotOneOf, or a single version for comparisons.
    /// </param>
    /// <returns>
    /// True when the condition matches; false for invalid versions, invalid or empty lists,
    /// or unsupported operators.
    /// </returns>
    private static bool MatchSemanticVersion(string op, string userValue, string ruleValue)
    {
        if (!SemanticVersion.TryParse(userValue, out var user)) return false;
        if (OperatorTypes.IsMultiValue(op))
        {
            // Invalid or empty lists never match, even for NotOneOf.
            if (!SemanticVersion.TryParseList(ruleValue, out var versions)) return false;
            // Compare versions rather than raw strings: "4", "4.0.0", and "4.0.0+build.1"
            // are equal because missing components default to zero and build metadata is ignored.
            var matches = versions.Any(version => user.CompareTo(version) == 0);
            return op == OperatorTypes.SemVerIsOneOf ? matches : !matches;
        }
        // <, <=, >, and >= compare against a single version.
        if (!SemanticVersion.TryParse(ruleValue, out var rule)) return false;
        // CompareTo handles numeric components and pre-release identifiers. A negative result
        // means the user's version is smaller, zero means equal, and a positive result means greater.
        var comparison = user.CompareTo(rule);
        return op switch
        {
            OperatorTypes.SemVerLessThan => comparison < 0,
            OperatorTypes.SemVerLessEqualThan => comparison <= 0,
            OperatorTypes.SemVerBiggerThan => comparison > 0,
            OperatorTypes.SemVerBiggerEqualThan => comparison >= 0,
            _ => false
        };
    }

    public static Operator Get(string operation)
    {
        if (OperatorTypes.IsSemVer(operation))
            return new Operator(operation, (user, rule) => MatchSemanticVersion(operation, user, rule));
        var theOperator = All.FirstOrDefault(x => x.Operation == operation);

        // unrecognized operators are treated as non-matches, not errors
        return theOperator ?? new Operator(operation, (_, _) => false);
    }
}
