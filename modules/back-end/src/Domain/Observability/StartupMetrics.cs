#nullable enable

using System.Diagnostics.Metrics;

namespace Domain.Observability;

/// <summary>
/// M10 — host startup instrumentation.
/// </summary>
/// <remarks>
/// <para>
/// The API server populates its cache from the database before the host finishes starting, and it
/// does so <b>blockingly</b>: <c>CachePopulatingHostedService.StartAsync</c> is awaited by the host,
/// and on failure it logs Critical and rethrows so the host does not start at all. That is the
/// right design — serving traffic from an empty cache would be worse — but it puts an unbounded,
/// database-dependent operation directly in front of readiness.
/// </para>
/// <para>
/// <b>This is deliberately not covered by the worker metrics.</b> Those describe long-running loops
/// that are expected to keep running; this is a one-shot operation whose <i>duration</i> is the
/// entire signal. Startup time is the difference between a rolling deploy that finishes and one
/// that stalls, and between a pod that recovers from an eviction and one that CrashLoopBackOffs —
/// and until now there was no number for it anywhere.
/// </para>
/// <para>
/// <b>A failure is recorded before the rethrow.</b> The exception does reach the host's own logging,
/// but by then the process is on its way down; recording it first means the failure is visible as a
/// metric even for a pod that never becomes ready enough to be scraped again.
/// </para>
/// </remarks>
public sealed class StartupMetrics
{
    private StartupMetrics(Meter meter, string instrumentPrefix)
    {
        Meter = meter;

        Stages = meter.CreateCounter<long>(
            $"{instrumentPrefix}startup.stages",
            unit: "{stage}",
            description:
            "Blocking startup stages completed, by stage and outcome. A failure here prevents the " +
            "host from starting at all.");

        Duration = meter.CreateHistogram<double>(
            $"{instrumentPrefix}startup.stage_duration",
            unit: "ms",
            description:
            "Time spent in one blocking startup stage. This is time the pod is not serving traffic, " +
            "so it bounds rollout and restart-recovery speed.");
    }

    /// <summary>The instrumentation in use for the running service.</summary>
    public static StartupMetrics Current { get; } =
        new(new Meter(FeatBitMeters.Api), FeatBitInstruments.ApiPrefix);

    /// <summary>The owning meter. Exposed so tests can listen to this instance specifically.</summary>
    public Meter Meter { get; }

    /// <summary>Counter of completed startup stages.</summary>
    public Counter<long> Stages { get; }

    /// <summary>Distribution of per-stage startup durations.</summary>
    public Histogram<double> Duration { get; }

    /// <summary>Records one blocking startup stage.</summary>
    /// <param name="stage">One of <see cref="StartupStages"/>.</param>
    /// <param name="outcome">One of <see cref="Outcomes"/>.</param>
    /// <param name="duration">How long the stage took.</param>
    public void RecordStage(string stage, string outcome, TimeSpan duration)
    {
        var tags = new[]
        {
            new KeyValuePair<string, object?>(ObservabilityTags.Stage, stage),
            new KeyValuePair<string, object?>(ObservabilityTags.Outcome, outcome)
        };

        Stages.Add(1, tags);
        Duration.Record(duration.TotalMilliseconds, tags);
    }
}

/// <summary>The fixed vocabulary for the <c>stage</c> dimension of <see cref="StartupMetrics"/>.</summary>
public static class StartupStages
{
    /// <summary>Loading flags, segments, and secrets into the cache before the host starts serving.</summary>
    public const string CachePopulation = "cache_population";
}
