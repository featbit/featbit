using Domain.Targeting;

namespace Domain.UnitTests.Targeting;

public class SemanticVersionTests
{
    [Theory]
    [InlineData("1.2", true)]
    [InlineData("1.2.3", true)]
    [InlineData("1.2.3-beta.2+build.01", true)]
    [InlineData("1.2.3-01a", true)]
    [InlineData("1.2.3-01", false)]
    [InlineData("01.2.3", false)]
    [InlineData("1.2.3.4", false)]
    [InlineData("1.2-beta", false)]
    [InlineData("v1.2.3", false)]
    [InlineData("1", false)]
    [InlineData("1.2.3\n", false)]
    [InlineData(" 1.2.3", false)]
    [InlineData("^1.2.3", false)]
    [InlineData("1.2.3-", false)]
    public void ValidatesFormat(string value, bool valid) =>
        Assert.Equal(valid, SemanticVersion.TryParse(value, out _));

    [Theory]
    [InlineData("1.10.0", "1.9.0", 1)]
    [InlineData("1.2", "1.2.0+build", 0)]
    [InlineData("1.2.0-beta.2", "1.2.0-beta.10", -1)]
    [InlineData("1.2.0-rc.1", "1.2.0", -1)]
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
        Assert.Equal(expected < 0, Operator.Get(OperatorTypes.SemVerLessThan).IsMatch(left, right));
        Assert.Equal(expected <= 0, Operator.Get(OperatorTypes.SemVerLessEqualThan).IsMatch(left, right));
        Assert.Equal(expected > 0, Operator.Get(OperatorTypes.SemVerBiggerThan).IsMatch(left, right));
        Assert.Equal(expected >= 0, Operator.Get(OperatorTypes.SemVerBiggerEqualThan).IsMatch(left, right));
    }

    [Fact]
    public void ListsUseSemanticEqualityAndRejectInvalidOperands()
    {
        var positive = Operator.Get(OperatorTypes.SemVerIsOneOf);
        var negative = Operator.Get(OperatorTypes.SemVerNotOneOf);
        Assert.False(positive.IsMatch("1.2+invalid", "[\"1.2\"]"));
        Assert.True(positive.IsMatch("1.2.0+abc", "[\"1.2\",\"2.0.0\"]"));
        Assert.False(negative.IsMatch("1.2.0", "[\"1.2\"]"));
        Assert.True(negative.IsMatch("2.0.0", "[\"1.2\"]"));
        foreach (var value in new[] { "[]", "null", "[1]", "[null]", "[\"invalid\"]", "[\"1.2\",\"bad\"]", "bad" })
        {
            Assert.False(OpValueValidator.IsValid(OperatorTypes.SemVerNotOneOf, value));
            Assert.False(negative.IsMatch("2.0.0", value));
        }
        foreach (var value in new[] { null, "", "invalid", "1.2.3.4" })
            Assert.False(negative.IsMatch(value, "[\"1.2\"]"));
        Assert.False(SemanticVersion.TryParse(new string('1', 257) + ".0.0", out _));
        Assert.False(SemanticVersion.TryParseList(System.Text.Json.JsonSerializer.Serialize(Enumerable.Repeat("1.2", 101)), out _));
        Assert.True(new Condition { Property = "version", Op = OperatorTypes.SemVerIsOneOf, Value = "[\"1.2\"]" }.IsMultiValue());
    }
}
