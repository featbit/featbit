using Domain.EndUsers;
using Domain.Evaluation;

namespace Domain.UnitTests.Evaluation;

public class EvaluationScopeTests
{
    [Theory]
    [InlineData(null, "value")]
    [InlineData("", "value")]
    [InlineData("   ", "value")]
    [InlineData("550e8400-e29b-41d4-a716-446655440000", null)]
    public void Constructor_InvalidVariation_Throws(string? id, string? value)
    {
        var variation = new Variation(id!, value!);
        Assert.False(variation.IsValid());

        var exception = Assert.Throws<MalformedDataException>(() =>
            new EvaluationScope(default, new EndUser(), [variation])
        );
        Assert.Equal("variations[0]", exception.PropertyPath);
    }

    [Fact]
    public void Constructor_NullVariation_Throws()
    {
        Assert.Throws<MalformedDataException>(() =>
            new EvaluationScope(default, new EndUser(), [null!])
        );
    }

    [Theory]
    [InlineData("not-a-guid")]
    [InlineData("12345")]
    [InlineData("variation-a")]
    public void Constructor_CustomVariationId_CanRetrieveVariation(string id)
    {
        var variation = new Variation(id, "value");
        var scope = new EvaluationScope(default, new EndUser(), [variation]);

        Assert.Same(variation, scope.GetVariation(id));
    }

    [Fact]
    public void Constructor_EmptyValue_IsValid()
    {
        var variation = new Variation("550e8400-e29b-41d4-a716-446655440000", "");
        Assert.True(variation.IsValid());

        var scope = new EvaluationScope(default, new EndUser(), [variation]);
        Assert.Same(variation, Assert.Single(scope.Variations));
    }
}
