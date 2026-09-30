using System.Net;
using Domain.Observability;

namespace Domain.UnitTests.Observability;

/// <summary>
/// M10 — webhook delivery, scheduled flag changes, startup stages, and outbound dependencies.
/// </summary>
[Collection(ObservabilityCollection.Name)]
public sealed class BackgroundWorkMetricsTests
{
    /// <summary>
    /// <b>Attempts and deliveries are separate instruments, and the difference is the diagnostic.</b>
    /// The sender retries up to three times, so three failed attempts followed by one success is a
    /// healthy delivery with a slow endpoint, while three failed attempts and a failed delivery is
    /// data loss. One counter could not tell those apart.
    /// </summary>
    [Fact]
    public void RecordWebhook_WithRetriedAttempts_CountsAttemptsSeparatelyFromDeliveries()
    {
        var metrics = WebhookMetrics.Current;
        using var collector = new MetricCollector(metrics.Meter);

        metrics.RecordAttempt(Outcomes.Failure, WebhookReasons.HttpError, TimeSpan.FromSeconds(1));
        metrics.RecordAttempt(Outcomes.Failure, WebhookReasons.HttpError, TimeSpan.FromSeconds(1));
        metrics.RecordAttempt(Outcomes.Success, WebhookReasons.Delivered, TimeSpan.FromSeconds(1));
        metrics.RecordDelivery(Outcomes.Success, WebhookReasons.Delivered);

        Assert.Equal(3, collector.For("webhook.attempts").Count());
        var delivery = Assert.Single(collector.For("webhook.deliveries"));

        Assert.Equal(Outcomes.Success, delivery.Tag(ObservabilityTags.Outcome));
    }

    /// <summary>
    /// A webhook that never leaves the process — a broken Handlebars template, an empty payload, or
    /// an SSRF block — used to be indistinguishable from one that was delivered. Each has its own
    /// reason so the fix is obvious from the metric alone.
    /// </summary>
    [Theory]
    [InlineData(WebhookReasons.TemplateError)]
    [InlineData(WebhookReasons.EmptyPayload)]
    [InlineData(WebhookReasons.Blocked)]
    [InlineData(WebhookReasons.TransportError)]
    public void RecordWebhook_WhenTheRequestNeverReachesTheNetwork_TagsADistinctReason(string reason)
    {
        var metrics = WebhookMetrics.Current;
        using var collector = new MetricCollector(metrics.Meter);

        metrics.RecordDelivery(Outcomes.Failure, reason);

        var delivery = Assert.Single(collector.For("webhook.deliveries"));

        Assert.Equal(reason, delivery.Tag(ObservabilityTags.Reason));
        Assert.NotEqual(WebhookReasons.Delivered, delivery.Tag(ObservabilityTags.Reason));
    }

    /// <summary>
    /// The due-count histogram is what turns "schedules are being applied" into "schedules are
    /// being applied fast enough". A backlog that grows every tick is invisible from the applied
    /// counter alone, which looks perfectly healthy while falling further behind.
    /// </summary>
    [Fact]
    public void ScheduleMetrics_ForOneCycle_RecordDueSeparatelyFromApplied()
    {
        var metrics = ScheduleMetrics.Current;
        using var collector = new MetricCollector(metrics.Meter);

        metrics.RecordDue(7);
        metrics.RecordApplied(Outcomes.Success, TimeSpan.FromMilliseconds(30));

        var due = Assert.Single(collector.For("schedule.due"));
        var applied = Assert.Single(collector.For("schedule.applied"));
        var duration = Assert.Single(collector.For("schedule.apply_duration"));

        Assert.Equal(7, due.Value, 0);
        Assert.Equal(Outcomes.Success, applied.Tag(ObservabilityTags.Outcome));
        Assert.Equal("ms", duration.Unit);
    }

    /// <summary>
    /// Lag answers the complaint that actually arrives — "my 09:00 rollout happened at 09:40" —
    /// which neither <c>schedule.due</c> nor <c>schedule.apply_duration</c> can. Apply duration
    /// measures how long the work took once it started, not how late it started.
    /// </summary>
    [Fact]
    public void ScheduleMetrics_RecordLag_MeasuresLatenessNotWorkDuration()
    {
        var metrics = ScheduleMetrics.Current;
        using var collector = new MetricCollector(metrics.Meter);

        var scheduled = new DateTime(2024, 1, 1, 9, 0, 0, DateTimeKind.Utc);

        metrics.RecordLag(scheduled, scheduled.AddMinutes(40));

        var lag = Assert.Single(collector.For("schedule.lag"));

        Assert.Equal(TimeSpan.FromMinutes(40).TotalMilliseconds, lag.Value, 0);
        Assert.Equal("ms", lag.Unit);
        Assert.Empty(collector.For("schedule.apply_duration"));
    }

    /// <summary>
    /// Negative lag can only come from clock skew between the writer and the worker. Recording it
    /// would drag the latency percentiles down and mask real lateness, so it is discarded rather
    /// than clamped to zero — a zero would claim the schedule was applied exactly on time.
    /// </summary>
    [Fact]
    public void ScheduleMetrics_RecordLag_DiscardsNegativeLagFromClockSkew()
    {
        var metrics = ScheduleMetrics.Current;
        using var collector = new MetricCollector(metrics.Meter);

        var scheduled = new DateTime(2024, 1, 1, 9, 0, 0, DateTimeKind.Utc);

        metrics.RecordLag(scheduled, scheduled.AddSeconds(-30));

        Assert.Empty(collector.For("schedule.lag"));
    }

    [Fact]
    public void StartupMetrics_ForOneStage_TagTheStageAndOutcome()
    {
        var metrics = StartupMetrics.Current;
        using var collector = new MetricCollector(metrics.Meter);

        metrics.RecordStage(
            StartupStages.CachePopulation, Outcomes.Failure, TimeSpan.FromSeconds(4));

        var stage = Assert.Single(collector.For("startup.stages"));
        var duration = Assert.Single(collector.For("startup.stage_duration"));

        Assert.Equal(StartupStages.CachePopulation, stage.Tag(ObservabilityTags.Stage));
        Assert.Equal(Outcomes.Failure, stage.Tag(ObservabilityTags.Outcome));
        Assert.Equal(StartupStages.CachePopulation, duration.Tag(ObservabilityTags.Stage));
    }

    /// <summary>
    /// The status class, not the status code. <c>404</c> and <c>422</c> are the same operational
    /// problem — we sent something the dependency rejected — and one series per status code would
    /// spread a single incident across a dozen thin lines.
    /// </summary>
    [Theory]
    [InlineData(200, DependencyReasons.Ok)]
    [InlineData(204, DependencyReasons.Ok)]
    [InlineData(301, DependencyReasons.Http3xx)]
    [InlineData(404, DependencyReasons.Http4xx)]
    [InlineData(422, DependencyReasons.Http4xx)]
    [InlineData(500, DependencyReasons.Http5xx)]
    [InlineData(503, DependencyReasons.Http5xx)]
    public void ReasonForStatus_ForAnyStatusCode_CollapsesItOntoItsClass(int status, string expected)
        => Assert.Equal(expected, DependencyMetrics.ReasonForStatus(status));

    /// <summary>
    /// Every billing method catches its exception and returns <c>null</c>, so the status code never
    /// reaches the caller. The delegating handler sees it before the catch block does, which is the
    /// entire reason the instrumentation lives there rather than in the service.
    /// </summary>
    [Fact]
    public void DependencyMetrics_WhenTheServiceDiscardsTheStatus_StillRecordTheStatusClass()
    {
        var metrics = DependencyMetrics.Current;
        using var collector = new MetricCollector(metrics.Meter);

        metrics.RecordRequest(
            DependencyNames.Billing,
            HttpMethod.Get.Method,
            Outcomes.Failure,
            DependencyMetrics.ReasonForStatus((int)HttpStatusCode.ServiceUnavailable),
            TimeSpan.FromMilliseconds(120));

        var request = Assert.Single(collector.For("dependency.requests"));
        var duration = Assert.Single(collector.For("dependency.duration"));

        Assert.Equal(DependencyNames.Billing, request.Tag(ObservabilityTags.Destination));
        Assert.Equal("GET", request.Tag(ObservabilityTags.Operation));
        Assert.Equal(DependencyReasons.Http5xx, request.Tag(ObservabilityTags.Reason));
        Assert.Equal("ms", duration.Unit);
    }
}
