using Domain.Targeting;

namespace Domain.UnitTests.Targeting;

public class SemanticVersionTests
{
    [Theory]
    [InlineData("1.2", true)]
    [InlineData("0", true)]
    [InlineData("4-beta.1", true)]
    [InlineData("4+build.2", true)]
    [InlineData("4-beta.1+build.2", true)]
    [InlineData("4.2-beta+build", true)]
    [InlineData("04", false)]
    [InlineData("4.", false)]
    [InlineData("4..0", false)]
    [InlineData("4.01", false)]
    [InlineData("4-01", false)]
    [InlineData("4-", false)]
    [InlineData("4+", false)]
    [InlineData("4-beta..1", false)]
    [InlineData("4+build..1", false)]
    [InlineData("4\n", false)]
    [InlineData("1.2.3", true)]
    [InlineData("1.2.3-beta.2+build.01", true)]
    [InlineData("1.2.3-01a", true)]
    [InlineData("1.2.3.4", false)]
    [InlineData("1.2-beta", true)]
    [InlineData("v1.2.3", false)]
    [InlineData(" 1.2.3", false)]
    [InlineData("^1.2.3", false)]
    public void ValidatesFormat(string value, bool valid) =>
        Assert.Equal(valid, SemanticVersion.TryParse(value, out _));

    [Theory]
    [InlineData("4", "4.0.0", 0)]
    [InlineData("4.0", "4", 0)]
    [InlineData("4-beta.1", "4.0.0-beta.1", 0)]
    [InlineData("4+build.2", "4.0.0", 0)]
    [InlineData("4.2-beta+build", "4.2.0-beta", 0)]
    [InlineData("4-beta.1", "4", -1)]
    [InlineData("4", "3.99.99", 1)]
    [InlineData("1.10.0", "1.9.0", 1)]
    [InlineData("1.2.0-beta.2", "1.2.0-beta.10", -1)]
    [InlineData("1.3.0-beta.1", "1.2.0", 1)]
    [InlineData("1.2.0-1", "1.2.0-alpha", -1)]
    [InlineData("1.2.0-alpha", "1.2.0-alpha.1", -1)]
    [InlineData("1.2.0-A", "1.2.0-a", -1)]
    [InlineData("99999999999999999999.0.0", "99999999999999999998.0.0", 1)]
    public void ComparesPrecedence(string left, string right, int expected)
    {
        Assert.True(SemanticVersion.TryParse(left, out var a));
        Assert.True(SemanticVersion.TryParse(right, out var b));
        Assert.Equal(expected, Math.Sign(a.CompareTo(b)));
    }

    [Theory]
    [InlineData("1.0.0", "2.0.0", -1)]
    [InlineData("2.0.0", "2.0.0", 0)]
    [InlineData("3.0.0", "2.0.0", 1)]
    public void ComparisonOperatorsMapTheComparisonResult(string left, string right, int expected)
    {
        Assert.Equal(expected < 0, Operator.Get(OperatorTypes.SemVerLessThan).IsMatch(left, right));
        Assert.Equal(expected <= 0, Operator.Get(OperatorTypes.SemVerLessEqualThan).IsMatch(left, right));
        Assert.Equal(expected > 0, Operator.Get(OperatorTypes.SemVerBiggerThan).IsMatch(left, right));
        Assert.Equal(expected >= 0, Operator.Get(OperatorTypes.SemVerBiggerEqualThan).IsMatch(left, right));
    }

    [Theory]
    [InlineData("4.0.0+build", true)]
    [InlineData("5.0.0", false)]
    public void ListOperatorsUseSemanticEquality(string userValue, bool matches)
    {
        const string versions = "[\"3.0.0\",\"4\"]";
        Assert.Equal(matches, Operator.Get(OperatorTypes.SemVerIsOneOf).IsMatch(userValue, versions));
        Assert.Equal(!matches, Operator.Get(OperatorTypes.SemVerNotOneOf).IsMatch(userValue, versions));
    }

    [Fact]
    public void InvalidListsFailValidationAndDoNotMatchNegativeOperator()
    {
        var negative = Operator.Get(OperatorTypes.SemVerNotOneOf);
        foreach (var value in new[] { "[]", "null", "[1]", "[null]", "[\"1.2\",\"bad\"]", "bad" })
        {
            Assert.False(OpValueValidator.IsValid(OperatorTypes.SemVerNotOneOf, value));
            Assert.False(negative.IsMatch("2.0.0", value));
        }
    }

    [Fact]
    public void InvalidUserVersionsDoNotMatchNegativeOperator()
    {
        var negative = Operator.Get(OperatorTypes.SemVerNotOneOf);
        foreach (var value in new[] { null, "", "invalid" })
            Assert.False(negative.IsMatch(value, "[\"1.2\"]"));
    }

    [Fact]
    public void AcceptsVersionsAndListsBeyondTheFormerLimits()
    {
        Assert.True(SemanticVersion.TryParse(new string('1', 257) + ".0.0", out _));
        Assert.True(SemanticVersion.TryParseList(System.Text.Json.JsonSerializer.Serialize(Enumerable.Repeat("1.2", 101)), out _));
    }

    [Theory]
    [InlineData(OperatorTypes.SemVerIsOneOf)]
    [InlineData(OperatorTypes.SemVerNotOneOf)]
    public void MembershipConditionsAreMultiValue(string op) =>
        Assert.True(new Condition { Property = "version", Op = op, Value = "[\"1.2\"]" }.IsMultiValue());
}
