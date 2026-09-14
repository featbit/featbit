using System.Globalization;
using Domain.Targeting;

namespace Domain.UnitTests.Targeting;

public class OpValueValidatorTests
{
    [Theory]
    [InlineData(OperatorTypes.Equal, "")]
    [InlineData(OperatorTypes.NotEqual, "")]
    [InlineData(OperatorTypes.IsTrue, null)]
    [InlineData(OperatorTypes.IsFalse, null)]
    [InlineData(OperatorTypes.BiggerThan, "10.5")]
    [InlineData(OperatorTypes.IsOneOf, "[\"company-1\",\"company-2\"]")]
    [InlineData(OperatorTypes.Contains, "value")]
    [InlineData(OperatorTypes.MatchRegex, "^[a-z]+$")]
    public void IsValid_ValidOperatorValue_ReturnsTrue(string op, string? value)
    {
        Assert.True(OpValueValidator.IsValid(op, value!));
    }

    [Theory]
    [InlineData("Unknown", "value")]
    [InlineData(OperatorTypes.BiggerThan, "not-a-number")]
    [InlineData(OperatorTypes.BiggerThan, "NaN")]
    [InlineData(OperatorTypes.IsOneOf, "[1]")]
    [InlineData(OperatorTypes.IsOneOf, "[\"company-1\",1]")]
    [InlineData(OperatorTypes.IsOneOf, "not-json")]
    [InlineData(OperatorTypes.Contains, "")]
    [InlineData(OperatorTypes.StartsWith, "")]
    [InlineData(OperatorTypes.MatchRegex, "")]
    [InlineData(OperatorTypes.MatchRegex, "[")]
    public void IsValid_InvalidOperatorValue_ReturnsFalse(string op, string value)
    {
        Assert.False(OpValueValidator.IsValid(op, value));
    }

    [Theory]
    [InlineData("[\"segment-1\"]", true)]
    [InlineData("[]", true)]
    [InlineData("[1]", false)]
    [InlineData("[\"segment-1\",1]", false)]
    [InlineData("not-json", false)]
    [InlineData("", false)]
    public void IsStringArray_Value_ReturnsExpectedResult(string value, bool expected)
    {
        Assert.Equal(expected, OpValueValidator.IsStringArray(value));
    }

    [Theory]
    [InlineData("10", true)]
    [InlineData("-10.5", true)]
    [InlineData("1e3", true)]
    [InlineData("NaN", false)]
    [InlineData("Infinity", false)]
    [InlineData("-Infinity", false)]
    [InlineData("1e9999", false)]
    [InlineData("-1e9999", false)]
    [InlineData("not-a-number", false)]
    [InlineData("", false)]
    public void IsNumber_Value_ReturnsExpectedResult(string value, bool expected)
    {
        Assert.Equal(expected, OpValueValidator.IsNumber(value));
    }

    [Fact]
    public void IsNumber_DotDecimalUnderNonDotCulture_ReturnsTrue()
    {
        var originalCulture = CultureInfo.CurrentCulture;
        try
        {
            CultureInfo.CurrentCulture = CultureInfo.GetCultureInfo("fr-FR");
            Assert.True(OpValueValidator.IsNumber("10.5"));
        }
        finally
        {
            CultureInfo.CurrentCulture = originalCulture;
        }
    }

    [Theory]
    [InlineData("^[a-z]+$", true)]
    [InlineData("a|b", true)]
    [InlineData("", false)]
    [InlineData("[", false)]
    [InlineData("(?<", false)]
    public void IsRegex_Value_ReturnsExpectedResult(string value, bool expected)
    {
        Assert.Equal(expected, OpValueValidator.IsRegex(value));
    }
}
