using Domain.Evaluation;

namespace Domain.UnitTests.Evaluation;

public class VariationTests
{
    [Theory]
    [InlineData("550e8400-e29b-41d4-a716-446655440000")]
    [InlineData("00000000-0000-0000-0000-000000000000")]
    [InlineData("ffffffff-ffff-ffff-ffff-ffffffffffff")]
    [InlineData("A0000000-0000-0000-0000-000000000000")]
    public void IsValid_WithValidGuidId_ReturnsTrue(string id)
    {
        var variation = new Variation(id, "value");
        Assert.True(variation.IsValid());
    }

    [Theory]
    [InlineData("not-a-guid")]
    [InlineData("12345")]
    [InlineData("variation-a")]
    public void IsValid_WithCustomId_ReturnsTrue(string id)
    {
        var variation = new Variation(id, "value");
        Assert.True(variation.IsValid());
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("\t\r\n")]
    public void IsValid_WithNullOrWhitespaceId_ReturnsFalse(string? id)
    {
        var variation = new Variation(id!, "value");
        Assert.False(variation.IsValid());
    }

    [Fact]
    public void IsValid_WithNullValue_ReturnsFalse()
    {
        Assert.False(new Variation("variation-a", null!).IsValid());
    }

    [Fact]
    public void IsValid_WithEmptyValue_ReturnsTrue()
    {
        Assert.True(new Variation("variation-a", "").IsValid());
    }
}
