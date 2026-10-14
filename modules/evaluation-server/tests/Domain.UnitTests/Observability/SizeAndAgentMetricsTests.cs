using Domain.Observability;

namespace Domain.UnitTests.Observability;

/// <summary>
/// P15 — the instruments added to close the remaining proposal sub-items: message sizes (M7),
/// the HTTP sync operations (M7), the insights request size (M8), and agent registration.
/// </summary>
[Collection(ObservabilityCollection.Name)]
public sealed class SizeAndAgentMetricsTests
{
    /// <summary>
    /// The inbound size shares the message tags, so an oversized payload can be attributed to a
    /// message type and outcome rather than only to a connection.
    /// </summary>
    [Fact]
    public void RecordMessage_WithSize_TagsSizeLikeTheOtherMessageInstruments()
    {
        var metrics = StreamingMetrics.Current;
        using var collector = new MetricCollector(metrics.Meter);

        metrics.RecordMessage(
            "data-sync",
            Outcomes.Success,
            StreamingReasons.Accepted,
            TimeSpan.FromMilliseconds(3),
            sizeBytes: 2048);

        var size = Assert.Single(collector.For("streaming.received_message_size"));

        Assert.Equal(2048, size.Value, 0);
        Assert.Equal("By", size.Unit);
        Assert.Equal("data-sync", size.Tag(ObservabilityTags.Operation));
        Assert.Equal(Outcomes.Success, size.Tag(ObservabilityTags.Outcome));
        Assert.Equal(StreamingReasons.Accepted, size.Tag(ObservabilityTags.Reason));
    }

    /// <summary>
    /// Size is optional. Callers that genuinely do not know it must not be forced to invent a
    /// number, and the count and duration must still be recorded.
    /// </summary>
    [Fact]
    public void RecordMessage_WithoutSize_StillCountsButRecordsNoSize()
    {
        var metrics = StreamingMetrics.Current;
        using var collector = new MetricCollector(metrics.Meter);

        metrics.RecordMessage(
            "data-sync", Outcomes.Success, StreamingReasons.Accepted, TimeSpan.FromMilliseconds(3));

        Assert.Single(collector.For("streaming.messages"));
        Assert.Empty(collector.For("streaming.received_message_size"));
    }

    /// <summary>
    /// A rejected message is exactly the one whose size matters most — it is how an oversized or
    /// malformed client is told apart from a merely chatty one — so the size must be recorded on
    /// the rejection path too.
    /// </summary>
    [Fact]
    public void RecordMessage_RejectedMessage_StillRecordsItsSize()
    {
        var metrics = StreamingMetrics.Current;
        using var collector = new MetricCollector(metrics.Meter);

        metrics.RecordMessage(
            StreamingReasons.Unknown,
            Outcomes.Rejected,
            StreamingReasons.UnknownType,
            TimeSpan.FromMilliseconds(1),
            sizeBytes: 999_999);

        var size = Assert.Single(collector.For("streaming.received_message_size"));

        Assert.Equal(999_999, size.Value, 0);
        Assert.Equal(StreamingReasons.Unknown, size.Tag(ObservabilityTags.Operation));
    }

    /// <summary>
    /// The outbound size carries only <c>operation</c>. It is recorded from the send path, where
    /// there is no outcome yet — the send either throws or it does not.
    /// </summary>
    [Fact]
    public void RecordSentMessage_ForOneMessage_TagsTheOperationOnly()
    {
        var metrics = StreamingMetrics.Current;
        using var collector = new MetricCollector(metrics.Meter);

        metrics.RecordSentMessage("data-sync", 65_536);

        var size = Assert.Single(collector.For("streaming.sent_message_size"));

        Assert.Equal(65_536, size.Value, 0);
        Assert.Equal("By", size.Unit);
        Assert.Equal("data-sync", size.Tag(ObservabilityTags.Operation));
        Assert.Null(size.Tag(ObservabilityTags.Outcome));
    }

    /// <summary>
    /// HTTP polling and streaming sync must not merge into one series. A deployment can shift
    /// between the two transports with no code change, and merging them would hide that shift.
    /// </summary>
    [Fact]
    public void SyncOperations_AsDeclared_KeepHttpDistinctFromStreaming()
    {
        Assert.Equal("http_full", SyncMetrics.HttpFullOperation);
        Assert.Equal("http_patch", SyncMetrics.HttpPatchOperation);

        Assert.NotEqual("full", SyncMetrics.HttpFullOperation);
        Assert.NotEqual("patch", SyncMetrics.HttpPatchOperation);
    }

    /// <summary>
    /// The HTTP sync path records through the same instruments as the streaming path, so one panel
    /// covers both transports and a missing transport is visible as an absent operation value.
    /// </summary>
    [Fact]
    public void RecordPayload_HttpOperation_UsesTheSameInstrumentsAsStreaming()
    {
        var metrics = SyncMetrics.Current;
        using var collector = new MetricCollector(metrics.Meter);

        metrics.RecordPayload(
            SyncMetrics.HttpFullOperation,
            "server",
            Outcomes.Success,
            TimeSpan.FromMilliseconds(8),
            itemCount: 17);

        var payload = Assert.Single(collector.For("sync.payloads"));

        Assert.Equal(SyncMetrics.HttpFullOperation, payload.Tag(ObservabilityTags.Operation));
        Assert.Equal("server", payload.Tag(ObservabilityTags.ConnectionType));
        Assert.Equal(17, Assert.Single(collector.For("sync.payload_items")).Value, 0);
    }

    /// <summary>
    /// A chunked request has no Content-Length. Recording zero would imply an empty body, which is
    /// the opposite of what a chunked upload usually means.
    /// </summary>
    [Fact]
    public void RecordRequestSize_NullContentLength_RecordsNothing()
    {
        var metrics = InsightsMetrics.Current;
        using var collector = new MetricCollector(metrics.Meter);

        metrics.RecordRequestSize(null);

        Assert.Empty(collector.For("insights.request_size"));
    }

    /// <summary>A present Content-Length is recorded verbatim, in bytes.</summary>
    [Fact]
    public void RecordRequestSize_PresentContentLength_RecordsItInBytes()
    {
        var metrics = InsightsMetrics.Current;
        using var collector = new MetricCollector(metrics.Meter);

        metrics.RecordRequestSize(8_192);

        var size = Assert.Single(collector.For("insights.request_size"));

        Assert.Equal(8_192, size.Value, 0);
        Assert.Equal("By", size.Unit);
    }

    /// <summary>
    /// Quota rejection is the reason the agent counter exists: nothing throws, so it appears in no
    /// error log and no exception metric. It must be distinguishable from an unauthorized key.
    /// </summary>
    [Fact]
    public void RecordRegistration_ForAnExhaustedQuota_SeparatesItFromUnauthorized()
    {
        var metrics = AgentMetrics.Current;
        using var collector = new MetricCollector(metrics.Meter);

        metrics.RecordRegistration(Outcomes.Rejected, AgentReasons.QuotaExceeded);
        metrics.RecordRegistration(Outcomes.Rejected, AgentReasons.Unauthorized);

        var measurements = collector.For("agent.registrations").ToArray();

        Assert.Equal(2, measurements.Length);
        Assert.Contains(
            measurements, m => (string?)m.Tag(ObservabilityTags.Reason) == AgentReasons.QuotaExceeded);
        Assert.Contains(
            measurements, m => (string?)m.Tag(ObservabilityTags.Reason) == AgentReasons.Unauthorized);
        Assert.All(
            measurements, m => Assert.Equal(Outcomes.Rejected, m.Tag(ObservabilityTags.Outcome)));
    }

    /// <summary>
    /// The agent reason vocabulary must stay closed. The registration endpoint is
    /// <c>[AllowAnonymous]</c>, so anything derived from the request would be an unbounded series
    /// mintable by an unauthenticated caller.
    /// </summary>
    [Fact]
    public void AgentReasons_AsDeclared_AreAllShortFixedTokens()
    {
        var values = typeof(AgentReasons)
            .GetFields(System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Static)
            .Where(f => f.IsLiteral && f.FieldType == typeof(string))
            .Select(f => (string)f.GetRawConstantValue()!)
            .ToArray();

        Assert.Equal(4, values.Length);
        Assert.All(values, v => Assert.Matches("^[a-z_]+$", v));
    }
}
