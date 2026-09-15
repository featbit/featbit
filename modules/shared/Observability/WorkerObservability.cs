#nullable enable

using System.Diagnostics;
using System.Diagnostics.Metrics;

namespace Domain.Observability;

/// <summary>
/// Liveness instrumentation for a long-running <c>BackgroundService</c>: whether the loop is
/// running, how long since it last iterated, how long since it last did useful work, and how often
/// it has thrown.
/// </summary>
/// <remarks>
/// <para>
/// This exists because a stopped worker is otherwise invisible: failure counters stay flat and the
/// process keeps passing its health checks, so "nothing is happening" looks identical to "nothing
/// needed to happen". Age gauges distinguish the two.
/// </para>
/// <para>
/// <b>Heartbeat versus success.</b> <see cref="Heartbeat"/> means the loop iterated;
/// <see cref="Success"/> means it accomplished something. A worker that is spinning but failing
/// shows a fresh heartbeat age and a growing success age, which is precisely the signal needed to
/// tell a stall from an idle period.
/// </para>
/// <para>
/// Ages are measured with <see cref="Stopwatch.GetTimestamp"/> — monotonic, so a wall-clock
/// adjustment cannot produce a negative or wildly large age. All state is a single
/// <see cref="long"/> read or written atomically, so gauge callbacks never block.
/// </para>
/// <para>
/// A stalled worker must be surfaced here and alerted on; it must <b>not</b> be wired into the
/// liveness probe, because failing liveness restarts the pod and readily produces a restart loop.
/// See <c>docs/observability/index.md</c> §9.
/// </para>
/// </remarks>
public sealed class WorkerObservability
{
    private readonly KeyValuePair<string, object?>[] _tags;

    private long _running;
    private long _startedTimestamp;
    private long _heartbeatTimestamp;
    private long _lastSuccessTimestamp;

    /// <summary>Registers the worker gauges and the loop-failure counter on <paramref name="meter"/>.</summary>
    /// <param name="meter">The owning meter.</param>
    /// <param name="instrumentPrefix">Service prefix, e.g. <see cref="FeatBitInstruments.ApiPrefix"/>.</param>
    /// <param name="workerName">Stable, low-cardinality worker name, e.g. <c>insights_flush</c>.</param>
    public WorkerObservability(Meter meter, string instrumentPrefix, string workerName)
    {
        ArgumentNullException.ThrowIfNull(meter);
        ArgumentException.ThrowIfNullOrWhiteSpace(instrumentPrefix);
        ArgumentException.ThrowIfNullOrWhiteSpace(workerName);

        WorkerName = workerName;
        _tags = new[] { new KeyValuePair<string, object?>(ObservabilityTags.Worker, workerName) };

        meter.CreateObservableGauge(
            $"{instrumentPrefix}worker.running",
            () => new Measurement<long>(Interlocked.Read(ref _running), _tags),
            unit: "{worker}",
            description: "1 while the worker loop is running, else 0.");

        meter.CreateObservableGauge(
            $"{instrumentPrefix}worker.heartbeat_age",
            () => new Measurement<long>(AgeSeconds(Interlocked.Read(ref _heartbeatTimestamp)), _tags),
            unit: "s",
            description: "Seconds since the worker loop last iterated. -1 before the first iteration.");

        meter.CreateObservableGauge(
            $"{instrumentPrefix}worker.last_success_age",
            () => new Measurement<long>(AgeSeconds(Interlocked.Read(ref _lastSuccessTimestamp)), _tags),
            unit: "s",
            description: "Seconds since the worker last completed useful work. -1 before the first success.");

        LoopFailures = meter.CreateCounter<long>(
            $"{instrumentPrefix}worker.loop_failures",
            unit: "{failure}",
            description: "Exceptions escaping the worker loop body, tagged by worker and error_type.");
    }

    /// <summary>The worker's stable name, as reported on the <c>worker</c> attribute.</summary>
    public string WorkerName { get; }

    /// <summary>Counter of exceptions escaping the loop body.</summary>
    public Counter<long> LoopFailures { get; }

    /// <summary>Marks the loop as running and records the first heartbeat.</summary>
    public void Started()
    {
        var now = Stopwatch.GetTimestamp();
        Interlocked.Exchange(ref _startedTimestamp, now);
        Interlocked.Exchange(ref _heartbeatTimestamp, now);
        Interlocked.Exchange(ref _running, 1);
    }

    /// <summary>
    /// Marks the loop as no longer running. Call from a <c>finally</c> so it is recorded on both
    /// graceful shutdown and an unhandled exception.
    /// </summary>
    public void Stopped() => Interlocked.Exchange(ref _running, 0);

    /// <summary>Records that the loop iterated. Call once per iteration, regardless of outcome.</summary>
    public void Heartbeat() => Interlocked.Exchange(ref _heartbeatTimestamp, Stopwatch.GetTimestamp());

    /// <summary>
    /// Records that the loop iterated <i>and</i> did useful work. Implies <see cref="Heartbeat"/>.
    /// </summary>
    public void Success()
    {
        var now = Stopwatch.GetTimestamp();
        Interlocked.Exchange(ref _heartbeatTimestamp, now);
        Interlocked.Exchange(ref _lastSuccessTimestamp, now);
    }

    /// <summary>
    /// Records an exception that escaped the loop body, tagged by worker and exception type. The
    /// exception message is deliberately not recorded — it is unbounded and may contain sensitive
    /// data. Log the exception object for that detail.
    /// </summary>
    public void LoopFailed(Exception exception)
    {
        LoopFailures.Add(
            1,
            new KeyValuePair<string, object?>(ObservabilityTags.Worker, WorkerName),
            new KeyValuePair<string, object?>(ObservabilityTags.ErrorType, exception?.GetType().Name ?? "Unknown"));
    }

    /// <summary>Seconds elapsed since <paramref name="timestamp"/>, or -1 if it was never set.</summary>
    private static long AgeSeconds(long timestamp)
    {
        if (timestamp == 0)
        {
            return -1;
        }

        var elapsed = Stopwatch.GetElapsedTime(timestamp);
        return elapsed < TimeSpan.Zero ? 0 : (long)elapsed.TotalSeconds;
    }
}
