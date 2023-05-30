using Streaming.Shared;

namespace Streaming.UnitTests.Shared;

public class TokenNumberTests
{
    [Theory]
    [InlineData("QQQ", 0)]
    [InlineData("QWS", 23)]
    [InlineData("BWZ", 128)]
    [InlineData("WHH", 255)]
    public void Should_Decode_Byte(string encoded, byte expected)
    {
        var parseResult = TokenNumber.TryDecodeByte(encoded, out var actual);

        Assert.True(parseResult);
        Assert.Equal(expected, actual);
    }

    [Theory]
    [InlineData("BDDBXZPZPXSDQ", 1661784847360)]
    [InlineData("BWSPHDXZUQ", 1234567890)]
    public void Should_Decode_Long(string encoded, long expected)
    {
        var parseResult = TokenNumber.TryDecodeLong(encoded, out var actual);

        Assert.True(parseResult);
        Assert.Equal(expected, actual);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData(" ")]
    public void Should_Decode_Null_Or_WhiteSpace_As_Zero(string encoded)
    {
        var byteParseResult = TokenNumber.TryDecodeByte(encoded, out var byteActual);
        var longParseResult = TokenNumber.TryDecodeLong(encoded, out var longActual);

        Assert.True(byteParseResult);
        Assert.Equal(0, byteActual);
        
        Assert.True(longParseResult);
        Assert.Equal(0, longActual);
    }

    [Theory]
    [InlineData("QBabcd")]
    [InlineData("1234QB")]
    public void Should_Return_False_When_Decode_Unknown_Character(string encoded)
    {
        Assert.False(TokenNumber.TryDecodeByte(encoded, out _));
        Assert.False(TokenNumber.TryDecodeLong(encoded, out _));
    }
}