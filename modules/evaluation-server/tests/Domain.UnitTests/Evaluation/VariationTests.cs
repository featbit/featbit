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
    // obviously invalid
    [InlineData("")]
    [InlineData("not-a-guid")]
    [InlineData("12345")]
    [InlineData("550e8400-e29b-41d4-a716-44665544000Z")] // invalid hex char
    // injection attempts
    [InlineData("'; DROP TABLE variations; --")]          // SQL injection
    [InlineData("<script>alert(1)</script>")]              // XSS
    [InlineData("../../etc/passwd")]                       // path traversal
    [InlineData("${7*7}")]                                 // template injection
    public void IsValid_WithInvalidOrMaliciousId_ReturnsFalse(string id)
    {
        var variation = new Variation(id, "value");
        Assert.False(variation.IsValid());
    }
}