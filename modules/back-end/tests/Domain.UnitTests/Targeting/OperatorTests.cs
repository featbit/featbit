using Domain.Targeting;

namespace Domain.UnitTests.Targeting;

public class OperatorTests
{
    [Theory]
    [InlineData(OperatorTypes.LessThan, "1", "2", true)]
    [InlineData(OperatorTypes.LessThan, "2", "1", false)]
    [InlineData(OperatorTypes.LessThan, "2", "2", false)]
    [InlineData(OperatorTypes.LessEqualThan, "1", "2", true)]
    [InlineData(OperatorTypes.LessEqualThan, "2", "2", true)]
    [InlineData(OperatorTypes.LessEqualThan, "3", "2", false)]
    [InlineData(OperatorTypes.BiggerThan, "2", "1", true)]
    [InlineData(OperatorTypes.BiggerThan, "1", "2", false)]
    [InlineData(OperatorTypes.BiggerThan, "2", "2", false)]
    [InlineData(OperatorTypes.BiggerEqualThan, "2", "1", true)]
    [InlineData(OperatorTypes.BiggerEqualThan, "2", "2", true)]
    [InlineData(OperatorTypes.BiggerEqualThan, "1", "2", false)]
    public void IsMatch_NumericOperators_ReturnsExpected(string op, string user, string rule, bool expected)
    {
        Assert.Equal(expected, Operator.Get(op).IsMatch(user, rule));
    }

    [Theory]
    [InlineData(OperatorTypes.LessThan, "not-a-number", "2")]
    [InlineData(OperatorTypes.LessThan, "1", "not-a-number")]
    [InlineData(OperatorTypes.BiggerThan, "NaN", "1")]
    public void IsMatch_NumericOperators_NonNumericInput_ReturnsFalse(string op, string user, string rule)
    {
        Assert.False(Operator.Get(op).IsMatch(user, rule));
    }

    [Theory]
    [InlineData(OperatorTypes.Equal, "abc", "abc", true)]
    [InlineData(OperatorTypes.Equal, "abc", "ABC", false)]
    [InlineData(OperatorTypes.NotEqual, "abc", "xyz", true)]
    [InlineData(OperatorTypes.NotEqual, "abc", "abc", false)]
    [InlineData(OperatorTypes.Contains, "hello world", "world", true)]
    [InlineData(OperatorTypes.Contains, "hello", "xyz", false)]
    [InlineData(OperatorTypes.NotContain, "hello", "xyz", true)]
    [InlineData(OperatorTypes.NotContain, "hello world", "world", false)]
    [InlineData(OperatorTypes.StartsWith, "hello world", "hello", true)]
    [InlineData(OperatorTypes.StartsWith, "hello", "world", false)]
    [InlineData(OperatorTypes.EndsWith, "hello world", "world", true)]
    [InlineData(OperatorTypes.EndsWith, "hello", "world", false)]
    public void IsMatch_StringOperators_ReturnsExpected(string op, string user, string rule, bool expected)
    {
        Assert.Equal(expected, Operator.Get(op).IsMatch(user, rule));
    }

    [Theory]
    [InlineData(OperatorTypes.MatchRegex, "abc123", "^abc\\d+$", true)]
    [InlineData(OperatorTypes.MatchRegex, "no-match", "^abc\\d+$", false)]
    [InlineData(OperatorTypes.NotMatchRegex, "no-match", "^abc\\d+$", true)]
    [InlineData(OperatorTypes.NotMatchRegex, "abc123", "^abc\\d+$", false)]
    public void IsMatch_RegexOperators_ReturnsExpected(string op, string user, string rule, bool expected)
    {
        Assert.Equal(expected, Operator.Get(op).IsMatch(user, rule));
    }

    [Theory]
    [InlineData(OperatorTypes.IsOneOf, "b", "[\"a\",\"b\",\"c\"]", true)]
    [InlineData(OperatorTypes.IsOneOf, "z", "[\"a\",\"b\",\"c\"]", false)]
    [InlineData(OperatorTypes.NotOneOf, "z", "[\"a\",\"b\",\"c\"]", true)]
    [InlineData(OperatorTypes.NotOneOf, "b", "[\"a\",\"b\",\"c\"]", false)]
    public void IsMatch_OneOfOperators_ReturnsExpected(string op, string user, string rule, bool expected)
    {
        Assert.Equal(expected, Operator.Get(op).IsMatch(user, rule));
    }

    [Theory]
    [InlineData(OperatorTypes.IsTrue, "true", true)]
    [InlineData(OperatorTypes.IsTrue, "TRUE", true)]
    [InlineData(OperatorTypes.IsTrue, "false", false)]
    [InlineData(OperatorTypes.IsFalse, "false", true)]
    [InlineData(OperatorTypes.IsFalse, "FALSE", true)]
    [InlineData(OperatorTypes.IsFalse, "true", false)]
    public void IsMatch_BooleanOperators_ReturnsExpected(string op, string user, bool expected)
    {
        // boolean operators ignore the rule value but it cannot be null (short-circuit guard)
        Assert.Equal(expected, Operator.Get(op).IsMatch(user, "ignored"));
    }

    [Fact]
    public void IsMatch_NullUserValue_AlwaysReturnsFalse()
    {
        Assert.False(Operator.Get(OperatorTypes.Equal).IsMatch(null!, "abc"));
    }

    [Fact]
    public void IsMatch_NullRuleValue_AlwaysReturnsFalse()
    {
        Assert.False(Operator.Get(OperatorTypes.Equal).IsMatch("abc", null!));
    }

    [Fact]
    public void Get_UnknownOperator_ReturnsAlwaysFalseOperator()
    {
        var op = Operator.Get("DoesNotExist");

        Assert.NotNull(op);
        Assert.False(op.IsMatch("anything", "anything"));
    }

    [Fact]
    public void All_ContainsEveryDefinedOperator()
    {
        var operations = Operator.All.Select(GetOperation).ToArray();

        Assert.Contains(OperatorTypes.LessThan, operations);
        Assert.Contains(OperatorTypes.IsFalse, operations);
        Assert.Equal(16, operations.Length);
    }

    private static string GetOperation(Operator op)
    {
        var prop = typeof(Operator).GetProperty("Operation",
            System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.NonPublic);
        return (string)prop!.GetValue(op)!;
    }
}
