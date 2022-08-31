using Domain.Streaming;

namespace Domain.UnitTests.Streaming;

public class TokenNumberTests
{
    [Theory]
    [InlineData("QQQ", 0)]
    [InlineData("QWS", 23)]
    [InlineData("BWZ", 128)]
    [InlineData("WHH", 255)]
    public void Should_Decode_Byte(string encoded, byte expected)
    {
        var actual = TokenNumber.DecodeByte(encoded);

        Assert.Equal(expected, actual);
    }

    [Theory]
    [InlineData("BDDBXZPZPXSDQ", 1661784847360)]
    [InlineData("BWSPHDXZUQ", 1234567890)]
    public void Should_Decode_Long(string encoded, long expected)
    {
        var actual = TokenNumber.DecodeLong(encoded);

        Assert.Equal(expected, actual);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData(" ")]
    public void Should_Decode_Null_Or_WhiteSpace_As_Zero(string encoded)
    {
        var byteActual = TokenNumber.DecodeByte(encoded);
        var longActual = TokenNumber.DecodeLong(encoded);

        Assert.Equal(0, byteActual);
        Assert.Equal(0, longActual);
    }
}