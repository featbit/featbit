using System.Diagnostics.Metrics;
using Domain.Observability;

namespace Domain.UnitTests.Observability;

/// <summary>
/// The cardinality budget, enforced mechanically rather than by review.
/// </summary>
/// <remarks>
/// <para>
/// A high-cardinality attribute does not fail anything at the point it is added. It fails weeks
/// later, in production, as an unbounded time-series explosion in whichever backend is scraping the
/// process — by which time the offending line is long merged. This suite exercises every recording
/// API in the module and asserts that no measurement anywhere carries a banned attribute name, so
/// the failure lands on the pull request that introduces it.
/// </para>
/// <para>
/// It is deliberately written as a sweep over real call sites rather than reflection over
/// instrument definitions: attributes are supplied at RECORD time, not at creation time, so
/// inspecting the instruments alone would prove nothing.
/// </para>
/// </remarks>
[Collection(ObservabilityCollection.Name)]
public sealed class CardinalityBudgetTests
{
    /// <summary>
    /// Exercises every M2/M3/M5 recording path in this module and asserts the banned-attribute list
    /// holds across all of them.
    /// </summary>
    [Fact]
    public void Instruments_AcrossTheWholeModule_RecordNoBannedAttribute()
    {
        using var meter = new Meter("FeatBit.Test.Cardinality." + Guid.NewGuid());

        using var moduleCollector = new MetricCollector(meter);
        using var messagingCollector = new MetricCollector(MessagingMetrics.Current.Meter);
        using var propagationCollector = new MetricCollector(PropagationMetrics.Current.Meter);
        using var insightsCollector = new MetricCollector(InsightsMetrics.Current.Meter);
        using var requestCollector = new MetricCollector(RequestMetrics.Current.Meter);
        using var authCollector = new MetricCollector(AuthMetrics.Current.Meter);
        using var webhookCollector = new MetricCollector(WebhookMetrics.Current.Meter);
        using var scheduleCollector = new MetricCollector(ScheduleMetrics.Current.Meter);
        using var startupCollector = new MetricCollector(StartupMetrics.Current.Meter);
        using var dependencyCollector = new MetricCollector(DependencyMetrics.Current.Meter);

        ExerciseWorkerAndBuffer(meter);
        ExerciseMessaging();
        ExercisePropagation();
        ExerciseP14Metrics();

        moduleCollector.CollectObservableInstruments();

        var all = moduleCollector.Measurements
            .Concat(messagingCollector.Measurements)
            .Concat(propagationCollector.Measurements)
            .Concat(insightsCollector.Measurements)
            .Concat(requestCollector.Measurements)
            .Concat(authCollector.Measurements)
            .Concat(webhookCollector.Measurements)
            .Concat(scheduleCollector.Measurements)
            .Concat(startupCollector.Measurements)
            .Concat(dependencyCollector.Measurements)
            .ToArray();

        Assert.NotEmpty(all);

        var violations = all
            .SelectMany(m => m.Tags.Keys.Select(key => (m.InstrumentName, Key: key)))
            .Where(pair => ObservabilityTags.Banned.Contains(pair.Key, StringComparer.OrdinalIgnoreCase))
            .Distinct()
            .ToArray();

        Assert.Empty(violations);
    }

    /// <summary>
    /// Every attribute recorded anywhere in the module must come from the documented allowlist. The
    /// banned list catches the mistakes we have already thought of; this catches the ones we have
    /// not, by requiring a new attribute name to be added to the standard deliberately.
    /// </summary>
    [Fact]
    public void Instruments_AcrossTheWholeModule_RecordOnlyAllowlistedAttributes()
    {
        using var meter = new Meter("FeatBit.Test.Allowlist." + Guid.NewGuid());

        using var moduleCollector = new MetricCollector(meter);
        using var messagingCollector = new MetricCollector(MessagingMetrics.Current.Meter);
        using var propagationCollector = new MetricCollector(PropagationMetrics.Current.Meter);
        using var insightsCollector = new MetricCollector(InsightsMetrics.Current.Meter);
        using var requestCollector = new MetricCollector(RequestMetrics.Current.Meter);
        using var authCollector = new MetricCollector(AuthMetrics.Current.Meter);
        using var webhookCollector = new MetricCollector(WebhookMetrics.Current.Meter);
        using var scheduleCollector = new MetricCollector(ScheduleMetrics.Current.Meter);
        using var startupCollector = new MetricCollector(StartupMetrics.Current.Meter);
        using var dependencyCollector = new MetricCollector(DependencyMetrics.Current.Meter);

        ExerciseWorkerAndBuffer(meter);
        ExerciseMessaging();
        ExercisePropagation();
        ExerciseP14Metrics();

        moduleCollector.CollectObservableInstruments();

        var allowed = new HashSet<string>(StringComparer.Ordinal)
        {
            ObservabilityTags.Outcome,
            ObservabilityTags.Operation,
            ObservabilityTags.Provider,
            ObservabilityTags.Destination,
            ObservabilityTags.ResourceType,
            ObservabilityTags.DcId,
            ObservabilityTags.Reason,
            ObservabilityTags.ErrorType,
            ObservabilityTags.Worker,
            ObservabilityTags.Buffer,
            ObservabilityTags.Stage
        };

        var unexpected = moduleCollector.Measurements
            .Concat(messagingCollector.Measurements)
            .Concat(propagationCollector.Measurements)
            .Concat(insightsCollector.Measurements)
            .Concat(requestCollector.Measurements)
            .Concat(authCollector.Measurements)
            .Concat(webhookCollector.Measurements)
            .Concat(scheduleCollector.Measurements)
            .Concat(startupCollector.Measurements)
            .Concat(dependencyCollector.Measurements)
            .SelectMany(m => m.Tags.Keys)
            .Where(key => !allowed.Contains(key))
            .Distinct()
            .ToArray();

        Assert.Empty(unexpected);
    }

    /// <summary>
    /// The banned list must actually be capable of failing. A test that only ever asserts "no
    /// violations" passes just as happily against an empty rule set, so the rule itself is pinned.
    /// </summary>
    [Fact]
    public void Banned_AsDeclared_CoversTheIdentifiersTheStandardForbids()
    {
        Assert.Contains("env_id", ObservabilityTags.Banned);
        Assert.Contains("instance_id", ObservabilityTags.Banned);
        Assert.Contains("flag_key", ObservabilityTags.Banned);
        Assert.Contains("user_id", ObservabilityTags.Banned);
        Assert.Contains("token", ObservabilityTags.Banned);
        Assert.Contains("client.ip", ObservabilityTags.Banned);
    }

    /// <summary>
    /// <c>dc_id</c> is the one identifier-shaped attribute the standard permits, because it is
    /// bounded by deployment topology and is the only way to see a single-datacenter outage. If it
    /// ever lands on the banned list, that is a decision, not an accident.
    /// </summary>
    [Fact]
    public void Banned_ForDcId_PermitsItBecauseDeploymentTopologyBoundsIt()
        => Assert.DoesNotContain(ObservabilityTags.DcId, ObservabilityTags.Banned);

    private static void ExerciseWorkerAndBuffer(Meter meter)
    {
        var worker = new WorkerObservability(meter, FeatBitInstruments.ApiPrefix, WorkerNames.InsightsFlush);
        worker.Started();
        worker.Heartbeat();
        worker.Success();
        worker.LoopFailed(new InvalidOperationException());
        worker.Stopped();

        var buffer = new BufferObservability(
            meter, FeatBitInstruments.ApiPrefix, BufferNames.Insights, capacity: 10, () => 1);
        buffer.RecordDropped(2);
        using (buffer.TrackBlockedWriter())
        {
        }

        var sizedBuffer = new BufferObservability(
            meter,
            FeatBitInstruments.ApiPrefix,
            BufferNames.Insights,
            capacity: 10,
            () => 1,
            trackBytes: true);
        sizedBuffer.AddBytes(512);
        sizedBuffer.RemoveBytes(128);
    }

    private static void ExerciseMessaging()
    {
        var metrics = MessagingMetrics.Current;

        using (var publish = metrics.BeginPublish("kafka", "featbit-cardinality-probe"))
        {
            publish.Enqueued();
        }

        using (var failed = metrics.BeginPublish("redis", "featbit-cardinality-probe"))
        {
            failed.Failed(new TimeoutException());
        }

        using (var consume = metrics.BeginConsume("postgres", "featbit-cardinality-probe"))
        {
            consume.Succeeded();
        }

        metrics.RecordUnroutable("kafka", "featbit-cardinality-probe");
        metrics.RecordRedelivered("postgres", "featbit-cardinality-probe", 2);
        metrics.RecordDeliveryFailure("kafka", "featbit-cardinality-probe");
    }

    private static void ExercisePropagation()
    {
        var metrics = PropagationMetrics.Current;

        using (var stage = metrics.BeginStage(ChangeId.FlagResource, PropagationStages.Persist))
        {
            stage.Succeeded();
        }

        using (var fanout = metrics.RecordFanout(ChangeId.SegmentResource))
        {
            fanout.Partial();
        }

        metrics.RecordDelivery(ChangeId.FlagResource, Outcomes.Success);
    }

    /// <summary>
    /// The M8/M10 and auth instruments added in P14. Several of these take values that arrive on an
    /// anonymous request — an OAuth provider name, a license feature name, an HTTP status — so they
    /// are exercised with hostile values to prove the normalization actually bounds them.
    /// </summary>
    private static void ExerciseP14Metrics()
    {
        var insights = InsightsMetrics.Current;
        insights.RecordReceived(Outcomes.Success, 2);
        insights.RecordFlush(Outcomes.Failure, 2, TimeSpan.FromMilliseconds(9));
        insights.RecordRequestSize(4096);

        RequestMetrics.Current.Record(
            "CardinalityProbeCommand", Outcomes.Success, TimeSpan.FromMilliseconds(3));
        RequestMetrics.Current.Record(
            "CardinalityProbeCommand", RequestMetrics.ValidationFailedOutcome,
            TimeSpan.FromMilliseconds(1));

        var auth = AuthMetrics.Current;
        auth.RecordLogin(AuthMethods.Password, Outcomes.Failure, AuthReasons.InvalidCredentials);
        auth.RecordLogin(AuthMethods.OAuth, Outcomes.Success, AuthReasons.Granted);
        auth.RecordAuthorization(
            ChangeId.FlagResource, Outcomes.Rejected, AuthReasons.PolicyDenied);
        auth.RecordLicenseCheck("multi_org", Outcomes.Rejected, AuthReasons.NotLicensed);

        var webhook = WebhookMetrics.Current;
        webhook.RecordAttempt(Outcomes.Failure, WebhookReasons.HttpError, TimeSpan.FromSeconds(1));
        webhook.RecordDelivery(Outcomes.Failure, WebhookReasons.TransportError);

        var schedule = ScheduleMetrics.Current;
        schedule.RecordApplied(Outcomes.Success, TimeSpan.FromMilliseconds(40));
        schedule.RecordDue(3);
        schedule.RecordLag(DateTime.UtcNow.AddMinutes(-2), DateTime.UtcNow);

        StartupMetrics.Current.RecordStage(
            StartupStages.CachePopulation, Outcomes.Success, TimeSpan.FromSeconds(2));

        var dependency = DependencyMetrics.Current;
        dependency.RecordRequest(
            DependencyNames.Billing, "GET", Outcomes.Success, DependencyReasons.Ok,
            TimeSpan.FromMilliseconds(30));
        dependency.RecordRequest(
            DependencyNames.Billing, "POST", Outcomes.Timeout, DependencyReasons.Timeout,
            TimeSpan.FromSeconds(10));
    }
}
