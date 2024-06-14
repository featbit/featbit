﻿using Domain.Shared;

namespace Streaming.UnitTests.Shared;

public class TokenTests
{
    [Theory]
    [ClassData(typeof(ValidTokens))]
    public void GetValidToken(string tokenString, Token expected)
    {
        var token = new Token(tokenString);

        Assert.Equal(token.Position, expected.Position);
        Assert.Equal(token.ContentLength, expected.ContentLength);
        Assert.Equal(token.Timestamp, expected.Timestamp);
        Assert.Equal(token.SecretString, expected.SecretString);
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
    public void GetInvalidToken(string tokenString)
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