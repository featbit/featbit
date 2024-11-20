using Domain.Insights;

namespace Domain.UnitTests.Insights;

public class VariationInsightTests
{
    [Theory]
    [InlineData("print(\"test\")")]
    [InlineData("this should fail")]
    [InlineData("select count(*) from system;")]
    public void ItShouldFailValidationWhenInvalidValuesAreProvided(string value1)
    {
        var variation = new VariationInsight
        {
            FeatureFlagKey = value1
        };

        Assert.False(variation.IsValid());
    }
}