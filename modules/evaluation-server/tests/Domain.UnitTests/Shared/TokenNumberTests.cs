using Domain.Shared;

namespace Domain.UnitTests.Shared;

public class TokenNumberTests
{
    [Theory]
    [InlineData("QQQ", 0)]
    [InlineData("QWS", 23)]
    [InlineData("BWZ", 128)]
    [InlineData("WHH", 255)]
    public void TryDecodeByte_ValidEncodedByte_ReturnsTrueAndExpectedValue(string encoded, byte expected)
    {
        var parseResult = TokenNumber.TryDecodeByte(encoded, out var actual);

        Assert.True(parseResult);
        Assert.Equal(expected, actual);
    }

    [Theory]
    [InlineData("BXHWUBPDQXDBZ", 1752914607618)]
    [InlineData("BXXWZBZQBBSUW", 1772818011392)]
    public void TryDecodeTimestamp_ValidEncodedLong_ReturnsTrueAndExpectedValue(string encoded, long expected)
    {
        var parseResult = TokenNumber.TryDecodeTimestamp(encoded, out var actual);

        Assert.True(parseResult);
        Assert.Equal(expected, actual);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData(" ")]
    public void TryDecode_NullOrWhitespaceInput_ReturnsTrueWithZeroValue(string? encoded)
    {
        var byteParseResult = TokenNumber.TryDecodeByte(encoded, out var byteActual);
        var longParseResult = TokenNumber.TryDecodeTimestamp(encoded, out var longActual);

        Assert.True(byteParseResult);
        Assert.Equal(0, byteActual);
        
        Assert.True(longParseResult);
        Assert.Equal(0, longActual);
    }

    [Theory]
    [InlineData("QBabcd")]
    [InlineData("1234QB")]
    public void TryDecode_UnknownCharacter_ReturnsFalse(string encoded)
    {
        Assert.False(TokenNumber.TryDecodeByte(encoded, out _));
        Assert.False(TokenNumber.TryDecodeTimestamp(encoded, out _));
    }
}