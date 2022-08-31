using Domain.Streaming;

namespace Domain.UnitTests.Streaming;

public class TokenTests
{
    [Theory]
    [ClassData(typeof(ValidTokens))]
    public void Should_Get_Valid_Token(
        string tokenString,
        byte position,
        byte contentLength,
        long timestamp,
        string envSecret)
    {
        var token = new Token(tokenString);
        
        Assert.Equal(token.Position, position);
        Assert.Equal(token.ContentLength, contentLength);
        Assert.Equal(token.Timestamp, timestamp);
        Assert.Equal(token.EnvSecret, envSecret);
        
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

public class ValidTokens : TheoryData<string, byte, byte, long, string>
{
    public ValidTokens()
    {
        Add(
            "QDUBHYWVkLWNiZTgtNCUyMDIyMDEwODA5MjIzNF9fOTRfXzExMV9fMjM3X19kZWZhdWx0XzRmOQQBDDBZXPDDZBQHWRh",
            69, 15, 1661874668105,
            "YWVkLWNiZTgtNCUyMDIyMDEwODA5MjIzNF9fOTRfXzExMV9fMjM3X19kZWZhdWx0XzRmOWRh"
        );
        
        Add(
            "QPPBHNjQ5LWNmY2EtNCUyMDIyMDYyOTEzMzU1OF9fMTU4X18yQQBDDBUQDUZSZQPMDBfXzQxMF9fZGVmYXVsdF8yODRmYg",
            44, 15, 1661906983804,
            "NjQ5LWNmY2EtNCUyMDIyMDYyOTEzMzU1OF9fMTU4X18yMDBfXzQxMF9fZGVmYXVsdF8yODRmYg=="
        );
        
        Add(
            "QPXBHMWIxLWQ0NWUtNCUyMDIyMDgwMjA2MzUzNl9fMTYxX18yMDRQQBDDBUQXBHXXQDfXzQyMV9fZGVmYXVsdF84ZDBmZQ",
            47, 15, 1661907157706,
            "MWIxLWQ0NWUtNCUyMDIyMDgwMjA2MzUzNl9fMTYxX18yMDRfXzQyMV9fZGVmYXVsdF84ZDBmZQ=="
        );
    }
}