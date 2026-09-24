using Domain.Observability;
using FeatBit.Observability.AspNetCore;
using Microsoft.Extensions.Configuration;

namespace FeatBit.Observability.Tests;

/// <summary>
/// Reading the observability settings from <see cref="IConfiguration"/>.
/// </summary>
/// <remarks>
/// <para>
/// Two properties matter here, and both are about not breaking a running deployment.
/// </para>
/// <para>
/// First, <b>the legacy <c>FEATBIT_*</c> variables must keep working</b>. They were the only way to
/// configure this before, so anything already setting them has to behave identically.
/// </para>
/// <para>
/// Second, <b>saying nothing must mean "leave it alone"</b>, not "disable it". The trace gate is
/// already initialized from the environment at type load, so resolving an absent configuration to a
/// disabled gate would quietly switch tracing off for someone who had turned it on.
/// </para>
/// </remarks>
[Collection(ObservabilityCollection.Name)]
public sealed class ObservabilityConfigurationTests
{
    private static IConfiguration Configuration(params (string Key, string Value)[] values)
        => new ConfigurationBuilder()
            .AddInMemoryCollection(values.Select(v => new KeyValuePair<string, string?>(v.Key, v.Value)))
            .Build();

    #region trace gate

    [Fact]
    public void ResolveTraceGate_WithNoConfiguration_ReturnsNullSoTheCurrentGateSurvives()
    {
        var gate = ObservabilityConfiguration.ResolveTraceGate(Configuration());

        Assert.Null(gate);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void ResolveTraceGate_WithBlankCategories_ReturnsNull(string categories)
    {
        var gate = ObservabilityConfiguration.ResolveTraceGate(
            Configuration((ObservabilityConfiguration.TraceCategoriesKey, categories)));

        Assert.Null(gate);
    }

    [Fact]
    public void ResolveTraceGate_WithOnlyTheStructuredKey_ReadsIt()
    {
        var gate = ObservabilityConfiguration.ResolveTraceGate(
            Configuration((ObservabilityConfiguration.TraceCategoriesKey, TraceCategories.FlagChange)));

        Assert.NotNull(gate);
        Assert.True(gate.IsEnabled(TraceCategories.FlagChange));
        Assert.False(gate.IsEnabled(TraceCategories.StreamingHandshake));
    }

    [Fact]
    public void ResolveTraceGate_WithOnlyTheLegacyVariable_FallsBackToIt()
    {
        var gate = ObservabilityConfiguration.ResolveTraceGate(
            Configuration((TraceGate.CategoriesVariable, TraceGate.AllCategories)));

        Assert.NotNull(gate);
        Assert.True(gate.IsEnabled(TraceCategories.FlagChange));
        Assert.True(gate.IsEnabled(TraceCategories.StreamingHandshake));
    }

    [Fact]
    public void ResolveTraceGate_WithBothKeysSet_PrefersTheStructuredKey()
    {
        var gate = ObservabilityConfiguration.ResolveTraceGate(Configuration(
            (ObservabilityConfiguration.TraceCategoriesKey, TraceCategories.StreamingHandshake),
            (TraceGate.CategoriesVariable, TraceCategories.FlagChange)));

        Assert.NotNull(gate);
        Assert.True(gate.IsEnabled(TraceCategories.StreamingHandshake));
        Assert.False(gate.IsEnabled(TraceCategories.FlagChange));
    }

    [Fact]
    public void ResolveTraceGate_WithAStructuredSampleRatio_AppliesIt()
    {
        var gate = ObservabilityConfiguration.ResolveTraceGate(Configuration(
            (ObservabilityConfiguration.TraceCategoriesKey, TraceGate.AllCategories),
            (ObservabilityConfiguration.TraceSampleRatioKey, "0")));

        Assert.NotNull(gate);
        Assert.True(gate.IsEnabled(TraceCategories.FlagChange));
        Assert.False(gate.ShouldTrace(TraceCategories.FlagChange));
    }

    [Fact]
    public void ResolveTraceGate_WithOnlyTheLegacySampleRatio_FallsBackToIt()
    {
        var gate = ObservabilityConfiguration.ResolveTraceGate(Configuration(
            (ObservabilityConfiguration.TraceCategoriesKey, TraceGate.AllCategories),
            (TraceGate.SampleRatioVariable, "0")));

        Assert.NotNull(gate);
        Assert.False(gate.ShouldTrace(TraceCategories.FlagChange));
    }

    [Fact]
    public void ResolveTraceGate_WithBothSampleRatiosSet_PrefersTheStructuredOne()
    {
        var gate = ObservabilityConfiguration.ResolveTraceGate(Configuration(
            (ObservabilityConfiguration.TraceCategoriesKey, TraceGate.AllCategories),
            (ObservabilityConfiguration.TraceSampleRatioKey, "1.0"),
            (TraceGate.SampleRatioVariable, "0")));

        Assert.NotNull(gate);
        Assert.True(gate.ShouldTrace(TraceCategories.FlagChange));
    }

    [Fact]
    public void ResolveTraceGate_WithCategoriesButNoRatio_SamplesEverything()
    {
        var gate = ObservabilityConfiguration.ResolveTraceGate(
            Configuration((ObservabilityConfiguration.TraceCategoriesKey, TraceGate.AllCategories)));

        Assert.NotNull(gate);
        Assert.True(gate.ShouldTrace(TraceCategories.FlagChange));
    }

    /// <summary>
    /// The double-underscore spelling is what makes this work in a container without any extra
    /// wiring, so it is worth pinning rather than assuming.
    /// </summary>
    [Fact]
    public void ResolveTraceGate_WithADoubleUnderscoreEnvironmentVariable_ReadsTheStructuredKey()
    {
        const string variable = "Observability__Traces__Categories";
        var original = Environment.GetEnvironmentVariable(variable);
        Environment.SetEnvironmentVariable(variable, TraceCategories.StreamingHandshake);

        try
        {
            var configuration = new ConfigurationBuilder().AddEnvironmentVariables().Build();

            var gate = ObservabilityConfiguration.ResolveTraceGate(configuration);

            Assert.NotNull(gate);
            Assert.True(gate.IsEnabled(TraceCategories.StreamingHandshake));
        }
        finally
        {
            Environment.SetEnvironmentVariable(variable, original);
        }
    }

    #endregion

    #region redaction salt

    [Fact]
    public void ResolveRedactionSalt_WithNoConfiguration_ReturnsNull()
    {
        Assert.Null(ObservabilityConfiguration.ResolveRedactionSalt(Configuration()));
    }

    [Fact]
    public void ResolveRedactionSalt_WithOnlyTheStructuredKey_ReadsIt()
    {
        var salt = ObservabilityConfiguration.ResolveRedactionSalt(
            Configuration((ObservabilityConfiguration.RedactionSaltKey, "from-appsettings")));

        Assert.Equal("from-appsettings", salt);
    }

    [Fact]
    public void ResolveRedactionSalt_WithOnlyTheLegacyVariable_FallsBackToIt()
    {
        var salt = ObservabilityConfiguration.ResolveRedactionSalt(
            Configuration((Redaction.SaltVariable, "from-legacy")));

        Assert.Equal("from-legacy", salt);
    }

    [Fact]
    public void ResolveRedactionSalt_WithBothKeysSet_PrefersTheStructuredKey()
    {
        var salt = ObservabilityConfiguration.ResolveRedactionSalt(Configuration(
            (ObservabilityConfiguration.RedactionSaltKey, "from-appsettings"),
            (Redaction.SaltVariable, "from-legacy")));

        Assert.Equal("from-appsettings", salt);
    }

    #endregion

    #region apply

    [Fact]
    public void Apply_WithNoConfiguration_LeavesTheCurrentGateUntouched()
    {
        var sentinel = new TraceGate([TraceCategories.FlagChange], 1d);
        var original = TraceGate.Current;
        TraceGate.SetCurrent(sentinel);

        try
        {
            ObservabilityConfiguration.Apply(Configuration());

            Assert.Same(sentinel, TraceGate.Current);
        }
        finally
        {
            TraceGate.SetCurrent(original);
        }
    }

    [Fact]
    public void Apply_WithAConfiguredCategory_InstallsTheGate()
    {
        var original = TraceGate.Current;

        try
        {
            ObservabilityConfiguration.Apply(
                Configuration((ObservabilityConfiguration.TraceCategoriesKey, TraceCategories.Messaging)));

            Assert.True(TraceGate.Current.IsEnabled(TraceCategories.Messaging));
            Assert.False(TraceGate.Current.IsEnabled(TraceCategories.FlagChange));
        }
        finally
        {
            TraceGate.SetCurrent(original);
        }
    }

    [Fact]
    public void Apply_WithNullConfiguration_Throws()
    {
        Assert.Throws<ArgumentNullException>(() => ObservabilityConfiguration.Apply(null!));
    }

    #endregion
}
