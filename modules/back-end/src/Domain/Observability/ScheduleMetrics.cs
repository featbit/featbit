#nullable enable

using System.Diagnostics.Metrics;

namespace Domain.Observability;

/// <summary>
/// M10 — scheduled flag change instrumentation.
/// </summary>
/// <remarks>
/// <para>
/// A flag schedule is a promise: the customer set a time, walked away, and expects the flag to
/// change without them. The worker that keeps that promise wakes every 45 seconds, and if applying
/// a schedule throws it logs the error and moves to the next one. Nothing retries, and nothing
/// escalates — so a schedule that never applies is discovered by the customer, not by us.
/// </para>
/// <para>
/// <b><see cref="Due"/> is the leading indicator, and it is free.</b> The worker already queries
/// for schedules whose time has passed, so recording how many it found costs nothing. A healthy
/// system reports a small number that returns to zero; a number that climbs cycle after cycle means
/// schedules are being found but not successfully applied, which is exactly the failure that is
/// otherwise silent.
/// </para>
/// <para>
/// Schedule IDs, titles, and flag keys are not recorded — they are unbounded and already present in
/// the existing log statements, which name both the ID and the title on success and on failure.
/// </para>
/// </remarks>
public sealed class ScheduleMetrics
{
    private ScheduleMetrics(Meter meter, string instrumentPrefix)
    {
        Meter = meter;

        Applied = meter.CreateCounter<long>(
            $"{instrumentPrefix}schedule.applied",
            unit: "{schedule}",
            description:
            "Scheduled flag changes the worker attempted to apply, by outcome. A failure is logged " +
            "and skipped without retry, so outcome=failure means a customer's scheduled change did not happen.");

        Duration = meter.CreateHistogram<double>(
            $"{instrumentPrefix}schedule.apply_duration",
            unit: "ms",
            description:
            "Time to apply one scheduled change, covering the flag draft, the schedule record, and " +
            "any linked change request.");

        Due = meter.CreateHistogram<int>(
            $"{instrumentPrefix}schedule.due",
            unit: "{schedule}",
            description:
            "Schedules found due on one worker cycle. A value that climbs across cycles means " +
            "schedules are being found but not applied.");

        Lag = meter.CreateHistogram<double>(
            $"{instrumentPrefix}schedule.lag",
            unit: "ms",
            description:
            "How late a scheduled change was applied, measured from its scheduled time to the " +
            "moment the worker applied it. Never below the 45-second poll interval, so alert on a " +
            "multiple of that rather than on any non-zero value.");
    }

    /// <summary>The instrumentation in use for the running service.</summary>
    public static ScheduleMetrics Current { get; } =
        new(new Meter(FeatBitMeters.Api), FeatBitInstruments.ApiPrefix);

    /// <summary>The owning meter. Exposed so tests can listen to this instance specifically.</summary>
    public Meter Meter { get; }

    /// <summary>Counter of scheduled changes the worker attempted to apply.</summary>
    public Counter<long> Applied { get; }

    /// <summary>Distribution of per-schedule apply durations.</summary>
    public Histogram<double> Duration { get; }

    /// <summary>Distribution of the number of schedules found due per cycle.</summary>
    public Histogram<int> Due { get; }

    /// <summary>Distribution of how late schedules were applied, in milliseconds.</summary>
    public Histogram<double> Lag { get; }

    /// <summary>Records one attempt to apply a scheduled change.</summary>
    /// <param name="outcome">One of <see cref="Outcomes"/>.</param>
    /// <param name="duration">How long the attempt took.</param>
    public void RecordApplied(string outcome, TimeSpan duration)
    {
        var tag = new KeyValuePair<string, object?>(ObservabilityTags.Outcome, outcome);

        Applied.Add(1, tag);
        Duration.Record(duration.TotalMilliseconds, tag);
    }

    /// <summary>Records how many schedules one worker cycle found due.</summary>
    public void RecordDue(int count) => Due.Record(count);

    /// <summary>
    /// Records how late one scheduled change was, from its scheduled time to now.
    /// </summary>
    /// <remarks>
    /// <b>This is the metric that answers the customer's question.</b> <see cref="Due"/> says
    /// schedules are piling up and <see cref="Applied"/> says whether applying them worked, but
    /// neither says "your 09:00 rollout happened at 09:40" — which is the complaint that actually
    /// arrives. Negative lag is discarded rather than recorded: it can only come from clock skew
    /// between the writer and this worker, and a negative sample would drag a latency percentile
    /// down and mask real lateness.
    /// </remarks>
    /// <param name="scheduledTimeUtc">The time the customer asked for, in UTC.</param>
    /// <param name="appliedAtUtc">The time the worker applied it, in UTC.</param>
    public void RecordLag(DateTime scheduledTimeUtc, DateTime appliedAtUtc)
    {
        var lag = (appliedAtUtc - scheduledTimeUtc).TotalMilliseconds;

        if (lag >= 0)
        {
            Lag.Record(lag);
        }
    }
}
