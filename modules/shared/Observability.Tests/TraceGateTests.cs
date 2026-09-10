using Domain.Observability;

namespace FeatBit.Observability.Tests;

/// <summary>
/// The custom-trace gate.
/// </summary>
/// <remarks>
/// The property that matters here is that the gate is <b>closed by default</b>. Custom spans are
/// the one signal in this effort with a non-trivial cost, so an unset or malformed environment
/// variable must produce no tracing at all rather than falling back to "on".
/// </remarks>
public sealed class TraceGateTests
{
    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void FromValues_WithNoCategories_DisablesEveryCategory(string? categories)
    {
        var gate = TraceGate.FromValues(categories, "1.0");

        Assert.False(gate.IsEnabled(TraceCategories.FlagChange));
        Assert.False(gate.IsEnabled(TraceCategories.StreamingHandshake));
        Assert.False(gate.ShouldTrace(TraceCategories.FlagChange));
    }

    [Fact]
    public void FromValues_WithOneNamedCategory_EnablesOnlyThatCategory()
    {
        var gate = TraceGate.FromValues(TraceCategories.FlagChange, "1.0");

        Assert.True(gate.IsEnabled(TraceCategories.FlagChange));
        Assert.False(gate.IsEnabled(TraceCategories.StreamingHandshake));
    }

    [Fact]
    public void FromValues_AllKeyword_EnablesEveryCategory()
    {
        var gate = TraceGate.FromValues(TraceGate.AllCategories, "1.0");

        Assert.True(gate.IsEnabled(TraceCategories.FlagChange));
        Assert.True(gate.IsEnabled(TraceCategories.StreamingHandshake));
        Assert.True(gate.IsEnabled(TraceCategories.Messaging));
    }

    [Fact]
    public void FromValues_WithWhitespaceAndMixedCasing_StillEnablesTheCategory()
    {
        var gate = TraceGate.FromValues($" {TraceCategories.FlagChange.ToUpperInvariant()} , ", "1.0");

        Assert.True(gate.IsEnabled(TraceCategories.FlagChange));
    }

    /// <summary>
    /// A malformed ratio must not disable an explicitly-enabled category. Categories are the
    /// operator's intent; the ratio is a volume control, so an unparseable value falls back to
    /// "sample everything in the categories you asked for" rather than silently sampling nothing.
    /// </summary>
    [Fact]
    public void FromValues_WithAnUnparseableRatio_StillTracesTheEnabledCategory()
    {
        var gate = TraceGate.FromValues(TraceCategories.FlagChange, "not-a-number");

        Assert.True(gate.ShouldTrace(TraceCategories.FlagChange));
    }

    [Fact]
    public void ShouldTrace_WithAZeroRatio_NeverTracesEvenAnEnabledCategory()
    {
        var gate = new TraceGate([TraceCategories.FlagChange], 0d);

        Assert.True(gate.IsEnabled(TraceCategories.FlagChange));

        for (var i = 0; i < 200; i++)
        {
            Assert.False(gate.ShouldTrace(TraceCategories.FlagChange));
        }
    }

    [Fact]
    public void ShouldTrace_WithAnOutOfRangeRatio_ClampsToTheZeroToOneRange()
    {
        Assert.True(new TraceGate([TraceCategories.FlagChange], 7d).ShouldTrace(TraceCategories.FlagChange));
        Assert.False(new TraceGate([TraceCategories.FlagChange], -3d).ShouldTrace(TraceCategories.FlagChange));
        Assert.False(new TraceGate([TraceCategories.FlagChange], double.NaN).ShouldTrace(TraceCategories.FlagChange));
    }

    [Fact]
    public void Disabled_ForEveryCategory_TracesNothing()
    {
        Assert.False(TraceGate.Disabled.IsEnabled(TraceGate.AllCategories));
        Assert.False(TraceGate.Disabled.ShouldTrace(TraceCategories.FlagChange));
    }

    [Fact]
    public void SetCurrent_WithNull_FallsBackToDisabledRatherThanThrowing()
    {
        var original = TraceGate.Current;
        try
        {
            TraceGate.SetCurrent(null!);

            Assert.Same(TraceGate.Disabled, TraceGate.Current);
        }
        finally
        {
            TraceGate.SetCurrent(original);
        }
    }
}
