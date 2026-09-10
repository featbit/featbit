using System.Collections.Concurrent;
using Domain.Observability;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Infrastructure.MQ.Backlog;

/// <summary>
/// Refreshes message-queue backlog depth on a timer so the <c>messaging.backlog</c> gauges can be
/// read without touching a datastore.
/// </summary>
/// <remarks>
/// <para>
/// Backlog depth answers the question consume-rate metrics cannot: <i>is the queue draining or
/// filling?</i> A healthy consume rate and a growing backlog look identical until the depth is
/// measured.
/// </para>
/// <para>
/// The reason this is a sampler rather than a gauge callback is the whole design constraint. An
/// <c>ObservableGauge</c> callback runs on the collector's schedule, on the collector's thread, and
/// is expected to return immediately; issuing a Redis <c>LLEN</c>, a Postgres <c>count(*)</c>, or a
/// Kafka offset query from inside one would put unbounded blocking I/O on the metrics export path,
/// where a slow datastore would stall collection for every other instrument in the process. Here
/// the I/O happens on a dedicated background loop and the gauge callback reads one
/// <see cref="long"/> from a dictionary.
/// </para>
/// <para>
/// <b>This is the one part of the observability work that adds runtime behavior</b> — a new
/// periodic query against production Redis, Postgres, and Kafka. Everything about it is therefore
/// bounded and fail-quiet: a fixed topic list, a configurable interval that cannot go below a floor,
/// per-cycle timeouts inside each probe, and unknown reported as <c>-1</c> rather than as a
/// misleading zero.
/// </para>
/// </remarks>
public sealed class MessagingBacklogSampler : BackgroundService
{
    /// <summary>Reported when a topic's depth could not be determined this cycle.</summary>
    public const long Unknown = -1;

    /// <summary>
    /// The shortest permitted interval. Sampling harder than this turns a diagnostic into a load
    /// generator — every cycle is a real query against a production datastore.
    /// </summary>
    public static readonly TimeSpan MinimumInterval = TimeSpan.FromSeconds(5);

    /// <summary>Interval used when none is configured.</summary>
    public static readonly TimeSpan DefaultInterval = TimeSpan.FromSeconds(30);

    private readonly IBacklogProbe[] _probes;
    private readonly TimeSpan _interval;
    private readonly ILogger<MessagingBacklogSampler> _logger;
    private readonly ConcurrentDictionary<(string Provider, string Topic), long> _depths = new();
    private readonly WorkerObservability _observability =
        ServiceMeter.ForWorker(WorkerNames.BacklogSampler);

    public MessagingBacklogSampler(
        IEnumerable<IBacklogProbe> probes,
        ILogger<MessagingBacklogSampler> logger,
        TimeSpan? interval = null)
    {
        _probes = probes.ToArray();
        _logger = logger;
        _interval = interval is null || interval.Value < MinimumInterval
            ? (interval is null ? DefaultInterval : MinimumInterval)
            : interval.Value;

        // Registered once, at construction, for a topic list fixed at startup. The gauge closure
        // captures nothing but this dictionary, so the callback cannot block or allocate per read.
        foreach (var probe in _probes)
        {
            foreach (var topic in probe.Topics)
            {
                var key = (probe.Provider, topic);
                _depths[key] = Unknown;

                MessagingMetrics.Current.RegisterBacklogGauge(
                    probe.Provider,
                    topic,
                    () => _depths.TryGetValue(key, out var depth) ? depth : Unknown);
            }
        }
    }

    /// <summary>The interval actually in use, after the minimum has been applied.</summary>
    public TimeSpan Interval => _interval;

    /// <summary>Last sampled depth, or <see cref="Unknown"/>. Exposed for tests.</summary>
    internal long DepthOf(string provider, string topic) =>
        _depths.TryGetValue((provider, topic), out var depth) ? depth : Unknown;

    protected override Task ExecuteAsync(CancellationToken stoppingToken)
        => WorkerLoop.Run(() => SampleLoopAsync(stoppingToken));

    private async Task SampleLoopAsync(CancellationToken cancellationToken)
    {
        if (_probes.Length == 0)
        {
            // No transport registered a probe, so there is nothing to sample. Returning rather than
            // spinning an empty timer keeps worker_running honest about what is actually running.
            return;
        }

        _observability.Started();

        try
        {
            using var timer = new PeriodicTimer(_interval);

            do
            {
                _observability.Heartbeat();

                await SampleOnceAsync(cancellationToken);

                _observability.Success();
            } while (await SafeWaitAsync(timer, cancellationToken));
        }
        finally
        {
            _observability.Stopped();
        }
    }

    internal async Task SampleOnceAsync(CancellationToken cancellationToken)
    {
        foreach (var probe in _probes)
        {
            try
            {
                var sampled = await probe.SampleAsync(cancellationToken);

                foreach (var topic in probe.Topics)
                {
                    _depths[(probe.Provider, topic)] =
                        sampled.TryGetValue(topic, out var depth) ? depth : Unknown;
                }
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                throw;
            }
            catch (Exception ex)
            {
                // One failing transport must not stop the others from being sampled, and must not
                // fault the loop — a backlog probe is a diagnostic, so it can never be the reason a
                // service stops.
                _observability.LoopFailed(ex);

                foreach (var topic in probe.Topics)
                {
                    _depths[(probe.Provider, topic)] = Unknown;
                }

                _logger.LogWarning(
                    ex,
                    "Backlog sampling failed for provider {Provider}; depth reported as unknown.",
                    probe.Provider);
            }
        }
    }

    private static async Task<bool> SafeWaitAsync(PeriodicTimer timer, CancellationToken cancellationToken)
    {
        try
        {
            return await timer.WaitForNextTickAsync(cancellationToken);
        }
        catch (OperationCanceledException)
        {
            // Shutdown, not a failure.
            return false;
        }
    }
}
