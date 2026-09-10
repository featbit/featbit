using System.Diagnostics;
using Domain.Observability;

namespace Domain.UnitTests.Observability;

/// <summary>
/// Behavior of the evaluation-server-specific instruments: M1 streaming, M4 store availability,
/// M6 rate limiting, and the T2 handshake span.
/// </summary>
[Collection(ObservabilityCollection.Name)]
public sealed class EvaluationServerMetricsTests : IDisposable
{
    private readonly TraceGate _originalGate = TraceGate.Current;

    public void Dispose() => TraceGate.SetCurrent(_originalGate);

    // ---- M1 streaming -----------------------------------------------------------------------

    /// <summary>
    /// The connection type reaches the process from a query-string parameter. Passing it through
    /// unmodified would let any caller mint unbounded attribute values, so anything outside the
    /// known set must collapse to <c>unknown</c> rather than becoming its own series.
    /// </summary>
    [Theory]
    [InlineData("client", "client")]
    [InlineData("server", "server")]
    [InlineData("relay-proxy", "relay_proxy")]
    [InlineData("CLIENT", "unknown")]
    [InlineData("../../etc/passwd", "unknown")]
    [InlineData("", "unknown")]
    public void RecordUpgrade_WithAnArbitraryConnectionType_NormalizesItToABoundedSet(string input, string expected)
    {
        var metrics = StreamingMetrics.Current;
        using var collector = new MetricCollector(metrics.Meter);

        metrics.RecordUpgrade(input, Outcomes.Success, StreamingReasons.Accepted);

        var upgrade = Assert.Single(collector.For("streaming.upgrades"));

        Assert.Equal(expected, upgrade.Tag(ObservabilityTags.ConnectionType));
    }

    [Fact]
    public void RecordSocketClosed_ForOneClose_RecordsTheReasonAndDurationTogether()
    {
        var metrics = StreamingMetrics.Current;
        using var collector = new MetricCollector(metrics.Meter);

        metrics.SocketOpened();
        metrics.SocketClosed("client", StreamingReasons.ClientClosed, TimeSpan.FromSeconds(42));

        var closed = Assert.Single(collector.For("streaming.closed"));
        var duration = Assert.Single(collector.For("streaming.connection_duration"));

        Assert.Equal(StreamingReasons.ClientClosed, closed.Tag(ObservabilityTags.Reason));
        Assert.Equal("client", closed.Tag(ObservabilityTags.ConnectionType));

        // Seconds, not milliseconds: streaming connections live for hours, and a millisecond
        // histogram's buckets would all overflow into the top bucket.
        Assert.Equal(42, duration.Value, 0);
        Assert.Equal("s", duration.Unit);
    }

    /// <summary>
    /// Active sockets and logical subscriptions are separate gauges because they diverge: one
    /// socket can carry many subscriptions, and a leak in either one alone is a distinct fault.
    /// </summary>
    [Fact]
    public void ActiveSockets_AfterOpensAndCloses_TracksOpenMinusClosed()
    {
        var metrics = StreamingMetrics.Current;
        using var collector = new MetricCollector(metrics.Meter);

        metrics.SocketOpened();
        metrics.SocketOpened();
        collector.CollectObservableInstruments();

        var before = Assert.Single(collector.For("streaming.active_sockets")).Value;

        collector.Clear();
        metrics.SocketClosed("client", StreamingReasons.ClientClosed, TimeSpan.FromSeconds(1));
        collector.CollectObservableInstruments();

        var after = Assert.Single(collector.For("streaming.active_sockets")).Value;

        Assert.Equal(before - 1, after);
    }

    // ---- M4 store availability --------------------------------------------------------------

    [Fact]
    public void RecordAvailabilityCheck_ForATimeout_DistinguishesItFromAFailure()
    {
        var metrics = StoreMetrics.Current;
        using var collector = new MetricCollector(metrics.Meter);

        metrics.RecordAvailabilityCheck("redis", Outcomes.Timeout, TimeSpan.FromMilliseconds(2000));
        metrics.RecordAvailabilityCheck("mongodb", Outcomes.Failure, TimeSpan.FromMilliseconds(5));

        var outcomes = collector.For("store.availability_checks")
            .Select(m => m.Tag(ObservabilityTags.Outcome))
            .ToArray();

        // A store that answered "no" and a store that did not answer at all are different faults:
        // the first is a healthy probe of an unhealthy store, the second may be a network partition.
        Assert.Contains(Outcomes.Timeout, outcomes);
        Assert.Contains(Outcomes.Failure, outcomes);
    }

    [Fact]
    public void RecordFailover_ForOneFailover_TagsTheStoreBeingFailedOverTo()
    {
        var metrics = StoreMetrics.Current;
        using var collector = new MetricCollector(metrics.Meter);

        metrics.RecordFailover("redis");

        Assert.Equal("redis", Assert.Single(collector.For("store.failovers")).Tag(ObservabilityTags.Provider));
    }

    [Fact]
    public void RecordNoStoreAvailable_WhenNoStoreIsAvailable_UsesItsOwnCounter()
    {
        var metrics = StoreMetrics.Current;
        using var collector = new MetricCollector(metrics.Meter);

        metrics.RecordNoStoreAvailable();

        Assert.Equal(1, Assert.Single(collector.For("store.no_store_available")).Value);
    }

    // ---- M6 rate limiting -------------------------------------------------------------------

    /// <summary>
    /// <c>fail_open</c> must never be folded into a normal allow. A request permitted because the
    /// limiter's backing store was unreachable looks identical to a permitted request in every
    /// other respect, and conflating them hides a total loss of rate limiting behind a healthy-
    /// looking allow rate.
    /// </summary>
    [Fact]
    public void RecordDecision_ForAFailOpen_KeepsItSeparateFromAnAllow()
    {
        var metrics = RateLimitMetrics.Current;
        using var collector = new MetricCollector(metrics.Meter);

        metrics.RecordDecision("streaming", Outcomes.Success, TimeSpan.FromMilliseconds(1));
        metrics.RecordDecision("streaming", Outcomes.FailOpen, TimeSpan.FromMilliseconds(1));
        metrics.RecordDecision("streaming", Outcomes.Rejected, TimeSpan.FromMilliseconds(1));

        var outcomes = collector.For("rate_limit.decisions")
            .Select(m => m.Tag(ObservabilityTags.Outcome))
            .ToArray();

        Assert.Equal(3, outcomes.Length);
        Assert.Contains(Outcomes.Success, outcomes);
        Assert.Contains(Outcomes.FailOpen, outcomes);
        Assert.Contains(Outcomes.Rejected, outcomes);
    }

    // ---- T2 handshake span ------------------------------------------------------------------

    [Fact]
    public void HandshakeTrace_WithTracingDisabled_CreatesNoSpan()
    {
        TraceGate.SetCurrent(TraceGate.Disabled);

        using var listener = ListenToHandshakeSpans(out var spans);

        using (var handshake = HandshakeTrace.Start("client"))
        {
            handshake.Accepted();
        }

        Assert.Empty(spans);
    }

    [Fact]
    public void HandshakeTrace_WhenAccepted_RecordsOutcomeAndConnectionType()
    {
        TraceGate.SetCurrent(new TraceGate([TraceCategories.StreamingHandshake], 1d));

        using var listener = ListenToHandshakeSpans(out var spans);

        using (var handshake = HandshakeTrace.Start("client"))
        {
            handshake.Accepted();
        }

        var span = Assert.Single(spans);

        Assert.Equal("client", span.GetTagItem(ObservabilityTags.ConnectionType));
        Assert.Equal(Outcomes.Success, span.GetTagItem(ObservabilityTags.Outcome));
        Assert.Equal(ActivityStatusCode.Ok, span.Status);
    }

    /// <summary>
    /// A rejected handshake is the whole reason this span exists, so it is retained regardless of
    /// the sample ratio. Sampling the decision up front — as a head-based sampler would — discards
    /// exactly the handshakes worth looking at.
    /// </summary>
    [Fact]
    public void HandshakeTrace_WhenRejected_IsRetainedEvenAtZeroSampleRatio()
    {
        TraceGate.SetCurrent(new TraceGate([TraceCategories.StreamingHandshake], 0d));

        using var listener = ListenToHandshakeSpans(out var spans);

        using (var handshake = HandshakeTrace.Start("client"))
        {
            handshake.Rejected(StreamingReasons.InvalidRequest);
        }

        var span = Assert.Single(spans);

        Assert.Equal(Outcomes.Rejected, span.GetTagItem(ObservabilityTags.Outcome));
        Assert.Equal(StreamingReasons.InvalidRequest, span.GetTagItem(ObservabilityTags.Reason));
        Assert.True(span.Recorded);
    }

    /// <summary>
    /// A successful handshake at a zero sample ratio must still produce a span object — the
    /// retention decision is made at the END, once the duration and outcome are known — but it must
    /// not be marked as recorded.
    /// </summary>
    [Fact]
    public void HandshakeTrace_FastSuccessAtZeroRatio_IsNotMarkedRecorded()
    {
        TraceGate.SetCurrent(new TraceGate([TraceCategories.StreamingHandshake], 0d));

        using var listener = ListenToHandshakeSpans(out var spans);

        using (var handshake = HandshakeTrace.Start("client"))
        {
            handshake.Accepted();
        }

        Assert.False(Assert.Single(spans).Recorded);
    }

    [Fact]
    public void HandshakeTrace_WithAnArbitraryConnectionType_NormalizesItLikeTheMetricsDo()
    {
        TraceGate.SetCurrent(new TraceGate([TraceCategories.StreamingHandshake], 1d));

        using var listener = ListenToHandshakeSpans(out var spans);

        using (var handshake = HandshakeTrace.Start("NOT-A-REAL-TYPE"))
        {
            handshake.Accepted();
        }

        // A span and a metric disagreeing about the connection type would make the two impossible
        // to correlate during an incident.
        Assert.Equal("unknown", Assert.Single(spans).GetTagItem(ObservabilityTags.ConnectionType));
    }

    private static ActivityListener ListenToHandshakeSpans(out List<Activity> spans)
    {
        var collected = new List<Activity>();
        spans = collected;

        // Resolved before registration: ActivitySource's constructor notifies every registered
        // listener, so reading FeatBitActivitySources from inside ShouldListenTo would re-enter its
        // static initializer and poison the type for the whole process.
        var sourceName = FeatBitActivitySources.Service.Name;

        var listener = new ActivityListener
        {
            ShouldListenTo = source => source.Name == sourceName,
            Sample = (ref ActivityCreationOptions<ActivityContext> _) => ActivitySamplingResult.AllData,
            ActivityStopped = activity =>
            {
                if (activity.GetTagItem(ObservabilityTags.ConnectionType) is not null)
                {
                    lock (collected)
                    {
                        collected.Add(activity);
                    }
                }
            }
        };

        ActivitySource.AddActivityListener(listener);

        return listener;
    }
}
