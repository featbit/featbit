using Domain.Evaluation;
using Domain.Insights;

namespace Domain.UnitTests.Insights;

public class VariationInsightTests
{
    private static Variation ValidVariation => new("550e8400-e29b-41d4-a716-446655440000", "true");

    [Theory]
    [InlineData("my-flag")]
    [InlineData("feature.flag_key-123")]
    [InlineData("A")]
    [InlineData("flag.v2")]
    [InlineData("a-b_c.d")]
    public void IsValid_WithValidFlagKeyAndVariation_ReturnsTrue(string flagKey)
    {
        var insight = new VariationInsight { FeatureFlagKey = flagKey, Variation = ValidVariation };
        Assert.True(insight.IsValid());
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("\t")]
    public void IsValid_WithNullOrWhitespaceFlagKey_ReturnsFalse(string? flagKey)
    {
        var insight = new VariationInsight { FeatureFlagKey = flagKey!, Variation = ValidVariation };
        Assert.False(insight.IsValid());
    }

    [Theory]
    // disallowed characters
    [InlineData("flag key")]                      // space
    [InlineData("flag!key")]                      // !
    [InlineData("flag@key")]                      // @
    // injection attempts
    [InlineData("'; DROP TABLE flags; --")]        // SQL injection
    [InlineData("<script>alert(1)</script>")]      // XSS
    [InlineData("../../etc/passwd")]               // path traversal
    [InlineData("$(rm -rf /)")]                    // shell command injection
    [InlineData("flag\nkey")]                      // newline
    [InlineData("flag\0key")]                      // null byte
    [InlineData("%3Cscript%3E")]                   // URL-encoded XSS
    public void IsValid_WithInvalidOrMaliciousFlagKey_ReturnsFalse(string flagKey)
    {
        var insight = new VariationInsight { FeatureFlagKey = flagKey, Variation = ValidVariation };
        Assert.False(insight.IsValid());
    }

    [Fact]
    public void IsValid_WithInvalidVariation_ReturnsFalse()
    {
        var insight = new VariationInsight
        {
            FeatureFlagKey = "valid-flag-key",
            Variation = new Variation("not-a-guid", "value")
        };
        Assert.False(insight.IsValid());
    }
}