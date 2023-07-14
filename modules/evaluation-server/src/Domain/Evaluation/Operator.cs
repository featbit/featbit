using System.Text.Json;
using System.Text.RegularExpressions;

namespace Domain.Evaluation;

public class Operator
{
    private string Operation { get; }
    private Func<string, string, bool> Func { get; }

    private Operator(string operation, Func<string, string, bool> func)
    {
        Operation = operation;
        Func = func;
    }

    public bool IsMatch(string? userValue, string? conditionValue)
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
        if (!double.TryParse(userValue, out var userDoubleValue) ||
            !double.TryParse(ruleValue, out var ruleDoubleValue))
        {
            return false;
        }

        // is NaN, return false
        if (double.IsNaN(userDoubleValue) || double.IsNaN(ruleDoubleValue))
        {
            return false;
        }

        var result = userDoubleValue.CompareTo(ruleDoubleValue);
        return result == desiredComparisonResult || result == otherDesiredComparisonResult;
    };

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

    public static Operator Get(string operation)
    {
        var theOperator = All.FirstOrDefault(x => x.Operation == operation);

        // unrecognized operators are treated as non-matches, not errors
        return theOperator ?? new Operator(operation, (_, _) => false);
    }
}