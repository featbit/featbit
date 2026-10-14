#nullable enable

using System.Diagnostics.Metrics;

namespace Domain.Observability;

/// <summary>
/// M4 — data-store availability instrumentation for the evaluation server's hybrid store.
/// </summary>
/// <remarks>
/// <para>
/// The evaluation server probes its stores in priority order every six seconds and serves reads
/// from the first one that answers. Today that failover is invisible: it is logged at Debug for a
/// timeout and not at all for a successful switch, so an evaluation server quietly serving stale
/// cache data looks identical to a healthy one.
/// </para>
/// <para>
/// <b>Timeouts are a separate outcome from failures.</b> A store that answers "no" in 5&#160;ms and a
/// store that never answers are different faults with different causes — collapsing them into
/// <c>failure</c> would hide the distinction that actually points at the problem.
/// </para>
/// <para>
/// <b>The selected store is a gauge per store, not a string.</b> Metric values are numeric, so
/// "which store is active" is expressed as one series per store reporting 1 or 0. That makes
/// <c>sum by (provider)</c> across a fleet answer "how many pods have failed over", which is the
/// question worth alerting on.
/// </para>
/// </remarks>
public sealed class StoreMetrics
{
    private Func<string>? _availableStoreProvider;
    private readonly HashSet<string> _knownStores = new(StringComparer.Ordinal);
    private readonly Lock _knownStoresLock = new();

    private StoreMetrics(Meter meter, string instrumentPrefix)
    {
        Meter = meter;

        AvailabilityChecks = meter.CreateCounter<long>(
            $"{instrumentPrefix}store.availability_checks",
            unit: "{check}",
            description:
            "Store availability probes by provider and outcome. outcome=timeout is distinct from " +
            "outcome=failure: the store never answered rather than answering negatively.");

        AvailabilityCheckDuration = meter.CreateHistogram<double>(
            $"{instrumentPrefix}store.availability_check_duration",
            unit: "ms",
            description: "Duration of a store availability probe, by provider and outcome.");

        Failovers = meter.CreateCounter<long>(
            $"{instrumentPrefix}store.failovers",
            unit: "{failover}",
            description:
            "Transitions of the selected store. Tagged with the provider being switched *to*, so a " +
            "recovery back to the primary is distinguishable from a failover away from it.");

        NoStoreAvailable = meter.CreateCounter<long>(
            $"{instrumentPrefix}store.no_store_available",
            unit: "{occurrence}",
            description:
            "Probe cycles where every store failed. The evaluation server keeps serving from its " +
            "in-memory cache in this state, so it is invisible to request-level metrics.");

        meter.CreateObservableGauge(
            $"{instrumentPrefix}store.selected",
            ObserveSelected,
            unit: "{store}",
            description: "1 for the currently selected store, 0 for every other store seen this process.");
    }

    /// <summary>The instrumentation in use for the running service.</summary>
    public static StoreMetrics Current { get; } =
        new(new Meter(FeatBitMeters.EvaluationServer), FeatBitInstruments.EvaluationServerPrefix);

    /// <summary>The owning meter. Exposed so tests can listen to this instance specifically.</summary>
    public Meter Meter { get; }

    /// <summary>Counter of store availability probes.</summary>
    public Counter<long> AvailabilityChecks { get; }

    /// <summary>Distribution of store availability probe durations.</summary>
    public Histogram<double> AvailabilityCheckDuration { get; }

    /// <summary>Counter of selected-store transitions.</summary>
    public Counter<long> Failovers { get; }

    /// <summary>Counter of probe cycles in which no store was available.</summary>
    public Counter<long> NoStoreAvailable { get; }

    /// <summary>
    /// Supplies the currently selected store name. Set once at startup. Until it is set the gauge
    /// reports nothing rather than a guess.
    /// </summary>
    public void SetAvailableStoreProvider(Func<string> provider)
    {
        ArgumentNullException.ThrowIfNull(provider);
        _availableStoreProvider = provider;
    }

    /// <summary>Records one store availability probe.</summary>
    /// <param name="provider">The store name.</param>
    /// <param name="outcome">One of <see cref="Outcomes"/>.</param>
    /// <param name="duration">How long the probe took.</param>
    public void RecordAvailabilityCheck(string provider, string outcome, TimeSpan duration)
    {
        Track(provider);

        var tags = new[]
        {
            new KeyValuePair<string, object?>(ObservabilityTags.Provider, provider),
            new KeyValuePair<string, object?>(ObservabilityTags.Outcome, outcome)
        };

        AvailabilityChecks.Add(1, tags);
        AvailabilityCheckDuration.Record(duration.TotalMilliseconds, tags);
    }

    /// <summary>Records a transition of the selected store to <paramref name="toProvider"/>.</summary>
    public void RecordFailover(string toProvider)
    {
        Track(toProvider);

        Failovers.Add(1, new KeyValuePair<string, object?>(ObservabilityTags.Provider, toProvider));
    }

    /// <summary>Records a probe cycle in which every store failed.</summary>
    public void RecordNoStoreAvailable() => NoStoreAvailable.Add(1);

    private void Track(string provider)
    {
        if (string.IsNullOrEmpty(provider))
        {
            return;
        }

        lock (_knownStoresLock)
        {
            _knownStores.Add(provider);
        }
    }

    private IEnumerable<Measurement<long>> ObserveSelected()
    {
        var provider = _availableStoreProvider;
        if (provider is null)
        {
            yield break;
        }

        var selected = provider();

        string[] stores;
        lock (_knownStoresLock)
        {
            _knownStores.Add(selected);
            stores = _knownStores.ToArray();
        }

        foreach (var store in stores)
        {
            yield return new Measurement<long>(
                store == selected ? 1 : 0,
                new KeyValuePair<string, object?>(ObservabilityTags.Provider, store));
        }
    }
}
