using Domain.Observability;

namespace FeatBit.Observability.Tests;

/// <summary>
/// M8 — the insights instruments, which are emitted by two different services.
/// </summary>
[Collection(ObservabilityCollection.Name)]
public sealed class InsightsMetricsTests : IDisposable
{
    private readonly string _originalMeterName = InsightsMetrics.Current.Meter.Name;

    public void Dispose()
        => InsightsMetrics.Configure(_originalMeterName, PrefixFor(_originalMeterName));

    private static string PrefixFor(string meterName) => meterName == FeatBitMeters.EvaluationServer
        ? FeatBitInstruments.EvaluationServerPrefix
        : FeatBitInstruments.ApiPrefix;

    /// <summary>
    /// <b>Received and persisted are separate instrument names on purpose.</b> They are emitted by
    /// different services, and the diagnostic is the <i>gap</i> between them: insights arriving at
    /// the evaluation server but never written by the back-end is silent data loss that quietly
    /// corrupts every experiment result. Folding them into one counter with a stage tag would make
    /// that comparison a filter rather than a subtraction, and would break the moment the two
    /// services disagreed about anything else on the tag set.
    /// </summary>
    [Fact]
    public void Instruments_ForReceivedAndPersisted_AreDistinct()
    {
        var metrics = InsightsMetrics.Current;
        using var collector = new MetricCollector(metrics.Meter);

        metrics.RecordReceived(Outcomes.Success, 10);
        metrics.RecordFlush(Outcomes.Success, 10, TimeSpan.FromMilliseconds(5));

        Assert.Single(collector.For("insights.received"));
        Assert.Single(collector.For("insights.persisted"));
    }

    /// <summary>
    /// The ingestion endpoint returns <c>200 OK</c> whether the events survived validation or not,
    /// so an SDK sending nothing but malformed events is indistinguishable from a healthy one at
    /// every other layer. This counter is the only place that difference shows up.
    /// </summary>
    [Fact]
    public void RecordReceived_WithRejectedAndAcceptedEvents_CountsThemSeparately()
    {
        var metrics = InsightsMetrics.Current;
        using var collector = new MetricCollector(metrics.Meter);

        metrics.RecordReceived(Outcomes.Success, 3);
        metrics.RecordReceived(Outcomes.Rejected, 2);

        var received = collector.For("insights.received").ToArray();

        Assert.Equal(2, received.Length);
        Assert.Equal(3, received.Single(m => m.Tag(ObservabilityTags.Outcome) == Outcomes.Success).Value, 0);
        Assert.Equal(2, received.Single(m => m.Tag(ObservabilityTags.Outcome) == Outcomes.Rejected).Value, 0);
    }

    /// <summary>
    /// Zero and negative counts record nothing at all. A request where everything validated would
    /// otherwise emit a <c>rejected</c> sample of zero on every call, which turns a counter that
    /// should be flat at zero into one that is constantly active and impossible to alert on.
    /// </summary>
    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public void RecordReceived_NonPositiveCount_RecordsNothing(int count)
    {
        var metrics = InsightsMetrics.Current;
        using var collector = new MetricCollector(metrics.Meter);

        metrics.RecordReceived(Outcomes.Rejected, count);

        Assert.Empty(collector.For("insights.received"));
    }

    /// <summary>
    /// <c>persisted</c> counts events, not batches. The flush worker's own worker metrics already
    /// say a loop iteration failed; what they cannot say is whether that cost 1 event or 10,000.
    /// </summary>
    [Fact]
    public void RecordFlush_WithABatch_CountsEventsAndRecordsTheBatchSize()
    {
        var metrics = InsightsMetrics.Current;
        using var collector = new MetricCollector(metrics.Meter);

        metrics.RecordFlush(Outcomes.Failure, 8_400, TimeSpan.FromSeconds(2));

        var persisted = Assert.Single(collector.For("insights.persisted"));
        var batchSize = Assert.Single(collector.For("insights.batch_size"));
        var duration = Assert.Single(collector.For("insights.flush_duration"));

        Assert.Equal(8_400, persisted.Value, 0);
        Assert.Equal(8_400, batchSize.Value, 0);
        Assert.Equal(Outcomes.Failure, persisted.Tag(ObservabilityTags.Outcome));
        Assert.Equal("ms", duration.Unit);
    }

    /// <summary>
    /// Both hosts emit these instruments, so the meter name cannot be baked in where the instrument
    /// is created. Without this, evaluation-server insights would publish under
    /// <c>featbit.api.*</c> and be attributed to the wrong service during an incident.
    /// </summary>
    [Fact]
    public void Configure_WithANewMeterName_RepointsTheMeterAndInstrumentPrefix()
    {
        InsightsMetrics.Configure(
            FeatBitMeters.EvaluationServer, FeatBitInstruments.EvaluationServerPrefix);

        var metrics = InsightsMetrics.Current;
        using var collector = new MetricCollector(metrics.Meter);

        metrics.RecordReceived(Outcomes.Success, 1);

        Assert.Equal(FeatBitMeters.EvaluationServer, metrics.Meter.Name);
        Assert.StartsWith(
            FeatBitInstruments.EvaluationServerPrefix,
            Assert.Single(collector.For("insights.received")).InstrumentName);
    }

    [Fact]
    public void Configure_SameValues_IsANoOpRatherThanARebuild()
    {
        var before = InsightsMetrics.Current;

        InsightsMetrics.Configure(before.Meter.Name, PrefixFor(before.Meter.Name));

        Assert.Same(before, InsightsMetrics.Current);
    }
}
