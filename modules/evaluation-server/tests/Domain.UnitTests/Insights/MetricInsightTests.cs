using Domain.Insights;

namespace Domain.UnitTests.Insights;

public class MetricInsightTests
{
    [Theory]
    [InlineData("print(\"test\")")]
    [InlineData("this should fail")]
    [InlineData("select count(*) from system;")]
    public void ItShouldFailValidationWhenInvalidValuesAreProvided(string value1)
    {
        var metric = new MetricInsight
        {
            EventName = value1,
        };

        Assert.False(metric.IsValid());
    }
}