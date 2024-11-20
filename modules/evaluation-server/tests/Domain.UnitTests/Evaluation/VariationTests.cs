using Domain.Evaluation;

namespace Domain.UnitTests.Evaluation;

public class VariationTests
{
    [Theory]
    [InlineData("test-value")]
    [InlineData("print(\"test\")")]
    [InlineData("3eacb184-2d79-49df")]
    public void TestInvalidVariationIds(string variationId)
    {
        var variation = new Variation(variationId, "");
        Assert.False(variation.IsValid());
    }

    [Theory]
    [InlineData("98a136e5-995b-44c9-8488-85704d777925")]
    [InlineData("a5b82844-3ab5-4af8-aade-a3d56bcc50c5")]
    [InlineData("cf2f228d-70af-4061-b89d-53cb1bccdf38")]
    public void TestValidVariationIds(string variationId)
    {
        var variation = new Variation(variationId, "");
        Assert.True(variation.IsValid());
    }
}