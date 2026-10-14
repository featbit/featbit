using Domain.Observability;

namespace FeatBit.Observability.Tests;

/// <summary>
/// Per-request metrics for the MediatR pipelines. Closes <b>F15</b>.
/// </summary>
[Collection(ObservabilityCollection.Name)]
public sealed class RequestMetricsTests : IDisposable
{
    private readonly string _originalMeterName = RequestMetrics.Current.Meter.Name;

    public void Dispose()
        => RequestMetrics.Configure(_originalMeterName, PrefixFor(_originalMeterName));

    private static string PrefixFor(string meterName) => meterName == FeatBitMeters.ControlPlane
        ? FeatBitInstruments.ControlPlanePrefix
        : FeatBitInstruments.ApiPrefix;

    [Fact]
    public void Record_ForOneRequest_EmitsTheCounterAndHistogramWithTheSameTags()
    {
        var metrics = RequestMetrics.Current;
        using var collector = new MetricCollector(metrics.Meter);

        metrics.Record("CreateFeatureFlag", Outcomes.Success, TimeSpan.FromMilliseconds(17));

        var total = Assert.Single(collector.For("request.total"));
        var duration = Assert.Single(collector.For("request.duration"));

        Assert.Equal("CreateFeatureFlag", total.Tag(ObservabilityTags.Operation));
        Assert.Equal("CreateFeatureFlag", duration.Tag(ObservabilityTags.Operation));
        Assert.Equal(Outcomes.Success, total.Tag(ObservabilityTags.Outcome));
        Assert.Equal("ms", duration.Unit);
        Assert.Equal(17, duration.Value, 0);
    }

    /// <summary>
    /// A rejected request and a canceled one are both counted apart from <c>failure</c>. Folding
    /// either into the failure rate would let a client sending bad input, or a browser navigating
    /// away, look exactly like a server outage.
    /// </summary>
    [Theory]
    [InlineData(RequestMetrics.ValidationFailedOutcome)]
    [InlineData(RequestMetrics.CancelledOutcome)]
    public void Record_ClientDrivenOutcomes_AreNotCountedAsFailures(string outcome)
    {
        var metrics = RequestMetrics.Current;
        using var collector = new MetricCollector(metrics.Meter);

        metrics.Record("CreateFeatureFlag", outcome, TimeSpan.FromMilliseconds(1));

        var total = Assert.Single(collector.For("request.total"));

        Assert.Equal(outcome, total.Tag(ObservabilityTags.Outcome));
        Assert.NotEqual(Outcomes.Failure, total.Tag(ObservabilityTags.Outcome));
    }

    /// <summary>
    /// <b>This is the whole reason F15 stayed open.</b> The behavior is registered from an assembly
    /// both the API server and the control plane build a pipeline from. If the meter name were fixed
    /// where the instrument is created, every control-plane command would publish under
    /// <c>featbit.api.*</c> — a metric that is confidently wrong, which costs more during an
    /// incident than one that is simply missing.
    /// </summary>
    [Fact]
    public void Configure_WithTheControlPlaneMeter_RepointsCommandsAwayFromTheApiMeter()
    {
        RequestMetrics.Configure(
            FeatBitMeters.ControlPlane, FeatBitInstruments.ControlPlanePrefix);

        var metrics = RequestMetrics.Current;
        using var collector = new MetricCollector(metrics.Meter);

        metrics.Record("SyncFlagToDataCenter", Outcomes.Success, TimeSpan.FromMilliseconds(4));

        Assert.Equal(FeatBitMeters.ControlPlane, metrics.Meter.Name);

        var total = Assert.Single(collector.For("request.total"));

        Assert.StartsWith(FeatBitInstruments.ControlPlanePrefix, total.InstrumentName);
        Assert.DoesNotContain(FeatBitInstruments.ApiPrefix, total.InstrumentName);
    }

    [Fact]
    public void Configure_WithEmptyValues_IgnoresThemRatherThanCreatingAnUnnamedMeter()
    {
        var before = RequestMetrics.Current;

        RequestMetrics.Configure(string.Empty, FeatBitInstruments.ApiPrefix);
        RequestMetrics.Configure(FeatBitMeters.Api, "   ");

        Assert.Same(before, RequestMetrics.Current);
    }
}
