using Domain.Token;

namespace Domain.UnitTests.Token;

public class TokenNumberTests
{
    [Theory]
    [InlineData("QBWSPHDXZU", "0123456789")]
    [InlineData("QQQ", "000")]
    [InlineData("WPD", "246")]
    [InlineData("BDDBXZPZPXSDQ", "1661784847360")]
    public void Should_Decode_String(string encoded, string expected)
    {
        var actual = TokenNumber.Decode(encoded);

        Assert.True(actual.Equals(expected, StringComparison.Ordinal));
    }

    [Theory]
    [InlineData(null, "")]
    [InlineData("", "")]
    [InlineData(" ", "")]
    public void Should_Decode_Null_Or_WhiteSpace(string encoded, string expected)
    {
        var actual = TokenNumber.Decode(encoded);

        Assert.True(actual.Equals(expected, StringComparison.Ordinal));
    }
}