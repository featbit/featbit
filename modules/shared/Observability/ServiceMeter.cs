#nullable enable

using System.Diagnostics.Metrics;

namespace Domain.Observability;

/// <summary>
/// The service-wide <see cref="Meter"/> that shared primitives such as
/// <see cref="WorkerObservability"/> and <see cref="BufferObservability"/> register on.
/// </summary>
/// <remarks>
/// <para>
/// This exists because those primitives are constructed deep inside workers and buffers that have
/// no sensible way to receive a meter by injection — a background service would otherwise have to
/// take an <c>IMeterFactory</c> purely so that it could name itself.
/// </para>
/// <para>
/// <b>The back-end assembly is shared by two hosts, so the prefix must be set explicitly.</b> The
/// control plane project-references the back-end's <c>Domain</c>, <c>Application</c>, and
/// <c>Infrastructure</c>. Without <see cref="Configure"/> at control-plane startup, every worker in
/// that process would publish under <c>featbit.api.*</c> and be silently misattributed to the API
/// server — the kind of error that is only discovered halfway through an incident.
/// </para>
/// <para>
/// Configuration is startup-only. Instruments capture the meter they were created on, so
/// reconfiguring after workers have started would leave their instruments orphaned on the old
/// meter.
/// </para>
/// </remarks>
public static class ServiceMeter
{
    private static Meter _current = new(FeatBitMeters.Api);

    /// <summary>The service-wide meter.</summary>
    public static Meter Current => _current;

    /// <summary>The instrument-name prefix for this service, e.g. <c>featbit.api.</c>.</summary>
    public static string InstrumentPrefix { get; private set; } = FeatBitInstruments.ApiPrefix;

    /// <summary>
    /// Points the service-wide meter at <paramref name="meterName"/> and
    /// <paramref name="instrumentPrefix"/>. Call once during startup, before any worker starts.
    /// No-op when the values are unchanged.
    /// </summary>
    public static void Configure(string meterName, string instrumentPrefix)
    {
        if (string.IsNullOrWhiteSpace(meterName) || string.IsNullOrWhiteSpace(instrumentPrefix))
        {
            return;
        }

        if (meterName == _current.Name && instrumentPrefix == InstrumentPrefix)
        {
            return;
        }

        var previous = _current;
        _current = new Meter(meterName);
        InstrumentPrefix = instrumentPrefix;
        previous.Dispose();
    }

    /// <summary>
    /// Creates worker-liveness instrumentation for <paramref name="workerName"/> on the
    /// service-wide meter.
    /// </summary>
    public static WorkerObservability ForWorker(string workerName)
        => new(_current, InstrumentPrefix, workerName);

    /// <summary>
    /// Creates buffer-saturation instrumentation for <paramref name="bufferName"/> on the
    /// service-wide meter.
    /// </summary>
    public static BufferObservability ForBuffer(
        string bufferName, int capacity, Func<int>? occupancyProvider = null, bool trackBytes = false)
        => new(_current, InstrumentPrefix, bufferName, capacity, occupancyProvider, trackBytes);
}
