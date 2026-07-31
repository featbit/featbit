using System.Diagnostics.Metrics;

namespace Api.Application.ControlPlane;

/// <summary>
/// #108 item 5: shared "static volatile snapshot + <see cref="ObservableGauge{T}"/>" helper. Each of
/// the three hand-rolled observable gauges (<see cref="CommitCoordinatorWorker"/>'s pending-backlog
/// and applied-watermark-lag gauges, <see cref="DcIdConsistencyChecker"/>'s unmatched-DC-count gauge)
/// followed the same shape: a snapshot of measurement rows refreshed at the end of a tick, read by an
/// <see cref="ObservableGauge{T}"/> callback that may run on a different thread than the tick that
/// refreshes it (hence <c>volatile</c>). This factors that shape into one small generic type. Each
/// caller still supplies its own metric name/unit/description/tags and its own row type/projection,
/// so names/tags are unchanged by this refactor.
/// </summary>
/// <typeparam name="T">One measurement row (e.g. a per-resource-type count, a per-DC/env lag).</typeparam>
internal sealed class ObservableGaugeSnapshot<T>(Func<T, Measurement<long>> toMeasurement)
{
    private volatile IReadOnlyList<T> _snapshot = Array.Empty<T>();

    /// <summary>
    /// Registers an <see cref="ObservableGauge{T}"/> on <paramref name="meter"/> backed by this
    /// snapshot: on export, the gauge reports one <see cref="Measurement{T}"/> per row currently in
    /// the snapshot, via the projection supplied at construction.
    /// </summary>
    public ObservableGauge<long> CreateGauge(Meter meter, string name, string unit, string description) =>
        meter.CreateObservableGauge(name, Observe, unit: unit, description: description);

    /// <summary>Replaces the snapshot the gauge callback reads on the next export.</summary>
    public void Update(IReadOnlyList<T> snapshot) => _snapshot = snapshot;

    /// <summary>
    /// Empties the snapshot (e.g. on losing leadership — see #105's non-leader zeroing, preserved by
    /// every call site that uses this type).
    /// </summary>
    public void Reset() => _snapshot = Array.Empty<T>();

    private IEnumerable<Measurement<long>> Observe() => _snapshot.Select(toMeasurement);
}
