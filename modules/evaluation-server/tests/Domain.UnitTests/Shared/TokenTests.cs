using Domain.Shared;

namespace Domain.UnitTests.Shared;

public class TokenTests
{
    [Theory]
    [ClassData(typeof(ValidTokens))]
    public void Constructor_ValidTokenString_ParsesAllFieldsAndIsValid(string tokenString, Token expected)
    {
        var token = new Token(tokenString);

        Assert.Equal(expected.Position, token.Position);
        Assert.Equal(expected.ContentLength, token.ContentLength);
        Assert.Equal(expected.Timestamp, token.Timestamp);
        Assert.Equal(expected.SecretString, token.SecretString);
        Assert.True(Secret.TryParse(token.SecretString, out _));
        Assert.True(expected.IsValid);
    }

    [Theory]
    [InlineData("")]
    [InlineData(" ")]
    [InlineData(null)]
    [InlineData("4chs")]
    [InlineData("5chars")]
    [InlineData("QDUBHYWVkLWNiZT")]
    [InlineData("QQQQS123")]
    public void Constructor_InvalidTokenString_IsValidReturnsFalse(string? tokenString)
    {
        var token = new Token(tokenString);

        Assert.False(token.IsValid);
    }
}

public class ValidTokens : TheoryData<string, Token>
{
    public ValidTokens()
    {
        Add(TestData.ClientTokenString, TestData.ClientToken);
        Add(TestData.ServerTokenString, TestData.ServerToken);
    }
}