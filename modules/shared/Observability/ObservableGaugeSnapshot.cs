#nullable enable

using System.Diagnostics.Metrics;

namespace Domain.Observability;

/// <summary>
/// A "volatile snapshot behind an <see cref="ObservableGauge{T}"/>" helper: a worker refreshes a set
/// of measurement rows at the end of a tick, and the gauge callback projects them on export.
/// </summary>
/// <remarks>
/// <para>
/// The callback may run on a different thread than the tick that refreshes the snapshot, hence the
/// <c>volatile</c> field. Reads are wait-free and allocation-light, which satisfies the rule that a
/// gauge callback must never block or perform I/O.
/// </para>
/// <para>
/// This is a copy of the control plane's original implementation, promoted here so all three
/// services share one pattern. The control-plane original is intentionally left in place;
/// consolidating the two is tracked as a follow-up.
/// </para>
/// </remarks>
/// <typeparam name="T">One measurement row, e.g. a per-resource-type count or a per-DC lag.</typeparam>
public sealed class ObservableGaugeSnapshot<T>(Func<T, Measurement<long>> toMeasurement)
{
    private volatile IReadOnlyList<T> _snapshot = Array.Empty<T>();

    /// <summary>
    /// Registers an <see cref="ObservableGauge{T}"/> on <paramref name="meter"/> backed by this
    /// snapshot. On export the gauge reports one <see cref="Measurement{T}"/> per row.
    /// </summary>
    public ObservableGauge<long> CreateGauge(Meter meter, string name, string unit, string description) =>
        meter.CreateObservableGauge(name, Observe, unit: unit, description: description);

    /// <summary>Replaces the snapshot the gauge callback reads on the next export.</summary>
    public void Update(IReadOnlyList<T> snapshot) => _snapshot = snapshot;

    /// <summary>Empties the snapshot, so the gauge reports no measurements.</summary>
    public void Reset() => _snapshot = Array.Empty<T>();

    private IEnumerable<Measurement<long>> Observe() => _snapshot.Select(toMeasurement);
}
