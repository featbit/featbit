using Domain.Observability;

namespace Domain.UnitTests.Observability;

/// <summary>
/// M7 — the data-sync and message-dispatch instruments.
/// </summary>
[Collection(ObservabilityCollection.Name)]
public sealed class SyncAndMessageMetricsTests
{
    /// <summary>
    /// The three tags travel together on all three sync instruments, so a panel can slice payload
    /// count, duration, and size by the same key without joining across differently-tagged series.
    /// </summary>
    [Fact]
    public void RecordPayload_ForOnePayload_TagsAllThreeInstrumentsIdentically()
    {
        var metrics = SyncMetrics.Current;
        using var collector = new MetricCollector(metrics.Meter);

        metrics.RecordPayload("full", "client", Outcomes.Success, TimeSpan.FromMilliseconds(12), 40);

        var payload = Assert.Single(collector.For("sync.payloads"));
        var duration = Assert.Single(collector.For("sync.duration"));
        var items = Assert.Single(collector.For("sync.payload_items"));

        foreach (var measurement in new[] { payload, duration, items })
        {
            Assert.Equal("full", measurement.Tag(ObservabilityTags.Operation));
            Assert.Equal("client", measurement.Tag(ObservabilityTags.ConnectionType));
            Assert.Equal(Outcomes.Success, measurement.Tag(ObservabilityTags.Outcome));
        }

        Assert.Equal("ms", duration.Unit);
        Assert.Equal(40, items.Value, 0);
    }

    /// <summary>
    /// A payload whose size could not be established without enumerating a lazy sequence records no
    /// size at all. Recording a zero would be worse than recording nothing: it is indistinguishable
    /// from a genuinely empty sync, which is one of the failures this metric exists to catch.
    /// </summary>
    [Fact]
    public void RecordPayload_UnknownItemCount_RecordsNoSizeButStillCountsTheSync()
    {
        var metrics = SyncMetrics.Current;
        using var collector = new MetricCollector(metrics.Meter);

        metrics.RecordPayload(
            "patch", "server", Outcomes.Failure, TimeSpan.FromMilliseconds(3), itemCount: null);

        Assert.Single(collector.For("sync.payloads"));
        Assert.Single(collector.For("sync.duration"));
        Assert.Empty(collector.For("sync.payload_items"));
    }

    /// <summary>
    /// <c>operation</c> on the message counter comes from the wire, so it is only ever the value of
    /// a <i>registered handler's</i> type. An unrecognized message must report the fixed
    /// <c>unknown</c> sentinel rather than echoing whatever the caller sent.
    /// </summary>
    [Fact]
    public void RecordMessage_UnknownType_UsesTheFixedSentinel()
    {
        var metrics = StreamingMetrics.Current;
        using var collector = new MetricCollector(metrics.Meter);

        metrics.RecordMessage(
            StreamingReasons.Unknown,
            Outcomes.Rejected,
            StreamingReasons.UnknownType,
            TimeSpan.FromMilliseconds(1));

        var message = Assert.Single(collector.For("streaming.messages"));

        Assert.Equal(StreamingReasons.Unknown, message.Tag(ObservabilityTags.Operation));
        Assert.Equal(StreamingReasons.UnknownType, message.Tag(ObservabilityTags.Reason));
        Assert.Equal(Outcomes.Rejected, message.Tag(ObservabilityTags.Outcome));
    }

    /// <summary>
    /// A message that arrives without the properties the dispatcher needs used to return silently —
    /// no log, no metric, no trace. It is now counted, which is the whole point of the reason value.
    /// </summary>
    [Fact]
    public void RecordMessage_MalformedEnvelope_IsCountedRatherThanSilentlyDropped()
    {
        var metrics = StreamingMetrics.Current;
        using var collector = new MetricCollector(metrics.Meter);

        metrics.RecordMessage(
            StreamingReasons.Unknown,
            Outcomes.Rejected,
            StreamingReasons.InvalidJson,
            TimeSpan.Zero);

        var message = Assert.Single(collector.For("streaming.messages"));
        var duration = Assert.Single(collector.For("streaming.message_duration"));

        Assert.Equal(StreamingReasons.InvalidJson, message.Tag(ObservabilityTags.Reason));
        Assert.Equal("ms", duration.Unit);
    }
}
