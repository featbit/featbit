using Infrastructure.MQ.Backlog;
using Microsoft.Extensions.Configuration;

namespace Infrastructure.UnitTests.MQ.Backlog;

/// <summary>
/// The sampler is the one piece of this observability work that adds runtime behavior, so its
/// off-switch has to be exactly right in both directions: a deliberate <c>0</c> must disable it,
/// and a typo must not.
/// </summary>
public class BacklogSamplerOptionsTests
{
    [Fact]
    public void Resolve_WithNoConfiguredValue_ReturnsTheDefaultInterval()
    {
        // Arrange
        var configuration = Build(null);

        // Act
        var interval = BacklogSamplerOptions.Resolve(configuration);

        // Assert
        Assert.Equal(MessagingBacklogSampler.DefaultInterval, interval);
    }

    [Theory]
    [InlineData("0")]
    [InlineData("-1")]
    [InlineData("-30")]
    public void Resolve_WithZeroOrLess_DisablesSampling(string value)
    {
        // Arrange
        var configuration = Build(value);

        // Act
        var interval = BacklogSamplerOptions.Resolve(configuration);

        // Assert
        Assert.Null(interval);
    }

    [Fact]
    public void Resolve_WithAPositiveValue_ReturnsThatManySeconds()
    {
        // Arrange
        var configuration = Build("90");

        // Act
        var interval = BacklogSamplerOptions.Resolve(configuration);

        // Assert
        Assert.Equal(TimeSpan.FromSeconds(90), interval);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("thirty")]
    [InlineData("30s")]
    public void Resolve_WithAnUnparseableValue_FallsBackToTheDefaultRatherThanDisabling(string value)
    {
        // Arrange
        var configuration = Build(value);

        // Act
        var interval = BacklogSamplerOptions.Resolve(configuration);

        // Assert
        // A mistyped setting must not silently turn a diagnostic off.
        Assert.Equal(MessagingBacklogSampler.DefaultInterval, interval);
    }

    [Fact]
    public void IntervalKey_IsUnderTheObservabilitySection()
    {
        // Assert
        // The other observability knobs live under Observability:, and a setting filed somewhere
        // else is a setting nobody finds.
        Assert.StartsWith("Observability:", BacklogSamplerOptions.IntervalKey, StringComparison.Ordinal);
    }

    private static IConfiguration Build(string? value)
    {
        var values = new Dictionary<string, string?>();
        if (value is not null)
        {
            values[BacklogSamplerOptions.IntervalKey] = value;
        }

        return new ConfigurationBuilder().AddInMemoryCollection(values).Build();
    }
}
