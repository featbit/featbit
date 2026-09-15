using Domain.Observability;

namespace FeatBit.Observability.Tests;

/// <summary>
/// Behavior of the M2 messaging instruments.
/// </summary>
/// <remarks>
/// The assertions that matter most here are the ones about what an outcome is allowed to CLAIM.
/// Every producer in the estate is fire-and-forget, so a publish that reports <c>success</c> would
/// be asserting a delivery guarantee the code does not provide — and a scope that forgets to report
/// an outcome must not be able to look like a success either. Both are pinned below.
/// </remarks>
[Collection(ObservabilityCollection.Name)]
public sealed class MessagingMetricsTests
{
    private const string Provider = "kafka";

    // Each test uses a destination unique to itself so that concurrently-running test classes
    // sharing the process-wide MessagingMetrics singleton cannot see each other's measurements.
    private static string Destination([System.Runtime.CompilerServices.CallerMemberName] string caller = "")
        => $"test-topic-{caller}";

    [Fact]
    public void PublishScope_Enqueued_RecordsEnqueuedNotSuccess()
    {
        var metrics = MessagingMetrics.Current;
        var destination = Destination();
        using var collector = new MetricCollector(metrics.Meter);

        using (var scope = metrics.BeginPublish(Provider, destination))
        {
            scope.Enqueued();
        }

        var published = Single(collector, "messaging.published", destination);

        Assert.Equal(1, published.Value);
        Assert.Equal(Outcomes.Enqueued, published.Tag(ObservabilityTags.Outcome));
        Assert.NotEqual(Outcomes.Success, published.Tag(ObservabilityTags.Outcome));
        Assert.Equal(Provider, published.Tag(ObservabilityTags.Provider));
        Assert.Equal("{message}", published.Unit);
    }

    /// <summary>
    /// The fail-closed rule. A scope disposed without an explicit outcome must record a failure:
    /// if the default were success, a code path that throws past the <c>Enqueued()</c> call would
    /// silently inflate the success rate, which is the single most dangerous way for an instrument
    /// to be wrong.
    /// </summary>
    [Fact]
    public void PublishScope_NoOutcomeReported_RecordsFailure()
    {
        var metrics = MessagingMetrics.Current;
        var destination = Destination();
        using var collector = new MetricCollector(metrics.Meter);

        using (metrics.BeginPublish(Provider, destination))
        {
        }

        Assert.Equal(
            Outcomes.Failure,
            Single(collector, "messaging.published", destination).Tag(ObservabilityTags.Outcome));
    }

    [Fact]
    public void PublishScope_Failed_TagsExceptionTypeNotMessage()
    {
        var metrics = MessagingMetrics.Current;
        var destination = Destination();
        using var collector = new MetricCollector(metrics.Meter);

        using (var scope = metrics.BeginPublish(Provider, destination))
        {
            scope.Failed(new InvalidOperationException("connection string: host=secret"));
        }

        var published = Single(collector, "messaging.published", destination);

        Assert.Equal(Outcomes.Failure, published.Tag(ObservabilityTags.Outcome));
        Assert.Equal(nameof(InvalidOperationException), published.Tag(ObservabilityTags.ErrorType));
        Assert.DoesNotContain(
            published.Tags.Values,
            value => value?.ToString()?.Contains("secret", StringComparison.Ordinal) == true);
    }

    /// <summary>
    /// The counter and the histogram must carry identical attributes. Without this, an operator
    /// cannot ask "how long did the failing publishes take?" — the two series will not join.
    /// </summary>
    [Fact]
    public void PublishScope_CounterAndHistogram_ShareTheSameAttributes()
    {
        var metrics = MessagingMetrics.Current;
        var destination = Destination();
        using var collector = new MetricCollector(metrics.Meter);

        using (var scope = metrics.BeginPublish(Provider, destination))
        {
            scope.Enqueued();
        }

        var published = Single(collector, "messaging.published", destination);
        var duration = Single(collector, "messaging.publish_duration", destination);

        Assert.Equal(published.Tags, duration.Tags);
        Assert.Equal("ms", duration.Unit);
        Assert.True(duration.Value >= 0);
    }

    [Fact]
    public void ConsumeScope_Succeeded_RecordsSuccess()
    {
        var metrics = MessagingMetrics.Current;
        var destination = Destination();
        using var collector = new MetricCollector(metrics.Meter);

        using (var scope = metrics.BeginConsume(Provider, destination))
        {
            scope.Succeeded();
        }

        Assert.Equal(
            Outcomes.Success,
            Single(collector, "messaging.consumed", destination).Tag(ObservabilityTags.Outcome));
    }

    /// <summary>
    /// A shutdown must not look like an outage. Cancellation is recorded as <c>rejected</c> so a
    /// rolling restart does not spike the consume failure rate and trip an alert.
    /// </summary>
    [Fact]
    public void ConsumeScope_Cancelled_IsNotRecordedAsFailure()
    {
        var metrics = MessagingMetrics.Current;
        var destination = Destination();
        using var collector = new MetricCollector(metrics.Meter);

        using (var scope = metrics.BeginConsume(Provider, destination))
        {
            scope.Cancelled();
        }

        var consumed = Single(collector, "messaging.consumed", destination);

        Assert.Equal(Outcomes.Rejected, consumed.Tag(ObservabilityTags.Outcome));
        Assert.NotEqual(Outcomes.Failure, consumed.Tag(ObservabilityTags.Outcome));
    }

    [Fact]
    public void ConsumeScope_NoOutcomeReported_RecordsFailure()
    {
        var metrics = MessagingMetrics.Current;
        var destination = Destination();
        using var collector = new MetricCollector(metrics.Meter);

        using (metrics.BeginConsume(Provider, destination))
        {
        }

        Assert.Equal(
            Outcomes.Failure,
            Single(collector, "messaging.consumed", destination).Tag(ObservabilityTags.Outcome));
    }

    [Fact]
    public void RecordUnroutable_ForAnyTopic_TagsProviderAndDestination()
    {
        var metrics = MessagingMetrics.Current;
        var destination = Destination();
        using var collector = new MetricCollector(metrics.Meter);

        metrics.RecordUnroutable(Provider, destination);

        var unroutable = Single(collector, "messaging.unroutable", destination);

        Assert.Equal(1, unroutable.Value);
        Assert.Equal(Provider, unroutable.Tag(ObservabilityTags.Provider));
    }

    /// <summary>
    /// Broker-reported delivery failures arrive after the publish scope has closed and already
    /// counted the message as enqueued. They therefore need their own counter — adding them to
    /// <c>published</c> would count one message twice.
    /// </summary>
    [Fact]
    public void RecordDeliveryFailure_AfterPublishReturned_IsSeparateFromThePublishedCounter()
    {
        var metrics = MessagingMetrics.Current;
        var destination = Destination();
        using var collector = new MetricCollector(metrics.Meter);

        metrics.RecordDeliveryFailure(Provider, destination);

        Assert.Single(
            collector.For("messaging.delivery_failures"),
            m => m.Tag(ObservabilityTags.Destination) == destination);
        Assert.DoesNotContain(
            collector.For("messaging.published"),
            m => m.Tag(ObservabilityTags.Destination) == destination);
    }

    [Fact]
    public void Instruments_OnTheConfiguredMeter_CarryTheServiceInstrumentPrefix()
    {
        var metrics = MessagingMetrics.Current;
        var destination = Destination();
        using var collector = new MetricCollector(metrics.Meter);

        metrics.RecordUnroutable(Provider, destination);

        var measurement = Single(collector, "messaging.unroutable", destination);

        Assert.StartsWith("featbit.", measurement.InstrumentName, StringComparison.Ordinal);
        Assert.EndsWith(".messaging.unroutable", measurement.InstrumentName, StringComparison.Ordinal);
    }

    /// <summary>
    /// A redelivery is only reported by transports that persist a per-message delivery count. The
    /// count is passed in rather than incremented per call, because the Postgres consumer knows how
    /// many messages in a polled batch were redelivered without inspecting them individually.
    /// </summary>
    [Fact]
    public void RecordRedelivered_WithAPositiveCount_TagsProviderAndDestination()
    {
        var metrics = MessagingMetrics.Current;
        var destination = Destination();
        using var collector = new MetricCollector(metrics.Meter);

        metrics.RecordRedelivered("postgres", destination, 3);

        var redelivered = Single(collector, "messaging.redelivered", destination);

        Assert.Equal(3, redelivered.Value);
        Assert.Equal("postgres", redelivered.Tag(ObservabilityTags.Provider));
        Assert.Equal("{message}", redelivered.Unit);
    }

    /// <summary>
    /// The common case is a batch in which nothing was redelivered. Recording a zero would put an
    /// endless stream of no-op points on the series and make "has anything been redelivered?"
    /// harder to answer, not easier.
    /// </summary>
    [Fact]
    public void RecordRedelivered_WithANonPositiveCount_RecordsNothing()
    {
        var metrics = MessagingMetrics.Current;
        var destination = Destination();
        using var collector = new MetricCollector(metrics.Meter);

        metrics.RecordRedelivered("postgres", destination, 0);
        metrics.RecordRedelivered("postgres", destination, -2);

        Assert.DoesNotContain(
            collector.For("messaging.redelivered"),
            m => m.Tag(ObservabilityTags.Destination) == destination);
    }

    private static RecordedMeasurement Single(MetricCollector collector, string name, string destination)
        => Assert.Single(
            collector.For(name), m => m.Tag(ObservabilityTags.Destination) == destination);
}
