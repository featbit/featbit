using Domain.Core;

namespace Domain.UnitTests.Core;

public class TokenTests
{
    [Theory]
    [ClassData(typeof(ValidTokens))]
    public void Should_Get_Valid_Token(
        string tokenString,
        byte position,
        byte contentLength,
        long timestamp,
        Secret secret)
    {
        var token = new Token(tokenString);
        
        Assert.Equal(token.Position, position);
        Assert.Equal(token.ContentLength, contentLength);
        Assert.Equal(token.Timestamp, timestamp);
        Assert.Equal(token.Secret, secret);
        
        Assert.True(token.IsValid);
    }

    [Theory]
    [InlineData("")]
    [InlineData(" ")]
    [InlineData(null)]
    [InlineData("4chs")]
    [InlineData("5chars")]
    [InlineData("QDUBHYWVkLWNiZT")]
    [InlineData("QQQQS123")]
    public void Should_Get_Invalid_Token(string tokenString)
    {
        var token = new Token(tokenString);
        
        Assert.False(token.IsValid);
    }
}

public class ValidTokens : TheoryData<string, byte, byte, long, Secret>
{
    public ValidTokens()
    {
        Add(
            "QDUBHYWVkLWNiZTgtNCUyMDIyMDEwODA5MjIzNF9fOTRfXzExMV9fMjM3X19kZWZhdWx0XzRmOQQBDDBZXPDDZBQHWRh",
            69, 15, 1661874668105, new Secret { AccountId = 94, ProjectId = 111, EnvId = 237 }
        );
        
        Add(
            "QPPBHNjQ5LWNmY2EtNCUyMDIyMDYyOTEzMzU1OF9fMTU4X18yQQBDDBUQDUZSZQPMDBfXzQxMF9fZGVmYXVsdF8yODRmYg",
            44, 15, 1661906983804, new Secret { AccountId = 158, ProjectId = 200, EnvId = 410 }
        );
        
        Add(
            "QPXBHMWIxLWQ0NWUtNCUyMDIyMDgwMjA2MzUzNl9fMTYxX18yMDRQQBDDBUQXBHXXQDfXzQyMV9fZGVmYXVsdF84ZDBmZQ",
            47, 15, 1661907157706, new Secret { AccountId = 161, ProjectId = 204, EnvId = 421 }
        );
    }
}