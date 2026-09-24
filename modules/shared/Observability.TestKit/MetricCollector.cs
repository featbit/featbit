using System.Diagnostics.Metrics;

namespace FeatBit.Observability.TestKit;

/// <summary>
/// One measurement captured by <see cref="MetricCollector"/>.
/// </summary>
/// <param name="InstrumentName">Fully-qualified instrument name, including the service prefix.</param>
/// <param name="Unit">The instrument's declared unit.</param>
/// <param name="Value">The measurement value, widened to <see cref="double"/>.</param>
/// <param name="Tags">The measurement's attributes.</param>
public sealed record RecordedMeasurement(
    string InstrumentName,
    string? Unit,
    double Value,
    IReadOnlyDictionary<string, object?> Tags)
{
    /// <summary>The value of <paramref name="tag"/>, or <c>null</c> when the tag is absent.</summary>
    public string? Tag(string tag) => Tags.TryGetValue(tag, out var value) ? value?.ToString() : null;

    /// <summary>Whether every supplied tag is present with the supplied value.</summary>
    public bool HasTags(params (string Key, string Value)[] expected)
        => expected.All(pair => Tag(pair.Key) == pair.Value);
}

/// <summary>
/// A <see cref="MeterListener"/> harness for asserting on instrument output.
/// </summary>
/// <remarks>
/// <para>
/// Modeled on the <c>CounterCollector</c> / <c>HistogramCollector</c> pair already used by the
/// control-plane integration tests, generalized so a single collector captures counters,
/// histograms, and observable gauges together. That matters because most of the interesting
/// assertions in this suite are about a counter and a histogram agreeing on their attributes — an
/// operator who cannot join <c>messaging.published</c> to <c>messaging.publish_duration</c> on
/// <c>outcome</c> has two metrics that individually look fine and together answer nothing.
/// </para>
/// <para>
/// Subscription is by <b>meter instance</b>, not meter name. Several of these instrument types are
/// process-wide singletons, and name-based filtering would make one test observe another's
/// measurements as the suite runs. Tests additionally tag their measurements with values unique to
/// the test so that concurrent classes cannot interfere.
/// </para>
/// </remarks>
public sealed class MetricCollector : IDisposable
{
    private readonly MeterListener _listener;
    private readonly List<RecordedMeasurement> _measurements = [];
    private readonly System.Threading.Lock _gate = new();

    /// <summary>Captures every instrument published by <paramref name="meter"/>.</summary>
    public MetricCollector(Meter meter)
        : this(instrument => ReferenceEquals(instrument.Meter, meter))
    {
    }

    /// <summary>
    /// Captures only the named instruments from <paramref name="meter"/>. Names are matched by
    /// suffix so a test does not have to know the service prefix in force.
    /// </summary>
    public MetricCollector(Meter meter, params string[] instrumentNames)
        : this(instrument =>
            ReferenceEquals(instrument.Meter, meter) &&
            instrumentNames.Any(name =>
                instrument.Name.Equals(name, StringComparison.Ordinal) ||
                instrument.Name.EndsWith("." + name, StringComparison.Ordinal)))
    {
    }

    private MetricCollector(Func<Instrument, bool> filter)
    {
        _listener = new MeterListener
        {
            InstrumentPublished = (instrument, listener) =>
            {
                if (filter(instrument))
                {
                    listener.EnableMeasurementEvents(instrument);
                }
            }
        };

        _listener.SetMeasurementEventCallback<long>((instrument, value, tags, _) => Record(instrument, value, tags));
        _listener.SetMeasurementEventCallback<int>((instrument, value, tags, _) => Record(instrument, value, tags));
        _listener.SetMeasurementEventCallback<double>((instrument, value, tags, _) => Record(instrument, value, tags));

        _listener.Start();
    }

    /// <summary>Everything captured so far.</summary>
    public IReadOnlyList<RecordedMeasurement> Measurements
    {
        get
        {
            lock (_gate)
            {
                return _measurements.ToArray();
            }
        }
    }

    /// <summary>
    /// Forces observable instruments to report. Gauges only produce a value when a listener asks
    /// for one, so a test that does not call this sees nothing from them.
    /// </summary>
    public void CollectObservableInstruments() => _listener.RecordObservableInstruments();

    /// <summary>Captured measurements whose instrument name ends with <paramref name="name"/>.</summary>
    public IReadOnlyList<RecordedMeasurement> For(string name)
        => Measurements
            .Where(m =>
                m.InstrumentName.Equals(name, StringComparison.Ordinal) ||
                m.InstrumentName.EndsWith("." + name, StringComparison.Ordinal))
            .ToArray();

    /// <summary>Discards everything captured so far.</summary>
    public void Clear()
    {
        lock (_gate)
        {
            _measurements.Clear();
        }
    }

    private void Record<T>(Instrument instrument, T value, ReadOnlySpan<KeyValuePair<string, object?>> tags)
        where T : struct
    {
        var dictionary = new Dictionary<string, object?>(StringComparer.Ordinal);
        foreach (var tag in tags)
        {
            dictionary[tag.Key] = tag.Value;
        }

        var measurement = new RecordedMeasurement(
            instrument.Name,
            instrument.Unit,
            Convert.ToDouble(value),
            dictionary);

        lock (_gate)
        {
            _measurements.Add(measurement);
        }
    }

    public void Dispose() => _listener.Dispose();
}
