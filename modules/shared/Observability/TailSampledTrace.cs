#nullable enable

using System.Diagnostics;

namespace Domain.Observability;

/// <summary>
/// A gated span whose retention decision is made when it ends rather than when it starts.
/// </summary>
/// <remarks>
/// <para>
/// This generalizes the pattern <c>HandshakeTrace</c> established for T2 so that T3, T4, and T5 do
/// not each ship a near-identical copy of it. The rule it encodes is the important part:
/// <b>the spans worth keeping are the failed ones and the slow ones, and neither is knowable when
/// the span starts.</b> Sampling at the start therefore throws away exactly the traces an
/// investigation needs, while keeping a random selection of the healthy ones nobody will ever look
/// at.
/// </para>
/// <para>
/// So the span is created whenever its category is enabled, and
/// <see cref="ActivityTraceFlags.Recorded"/> — the flag exporters actually honor — is set on the way
/// out: always on failure, always past the slow threshold, and otherwise only if the configured
/// sample ratio says so.
/// </para>
/// <para>
/// <b>It is a struct with a null activity when the category is off.</b> Every method is a null check
/// in that state, so a disabled category costs an allocation-free no-op rather than a branch at each
/// call site. Custom trace categories are off by default, so that is the normal case.
/// </para>
/// <para>
/// Callers are responsible for tag values staying inside the attribute allowlist and the cardinality
/// budget. A span may legitimately carry higher-cardinality detail than a metric — it is one record
/// rather than a time series — but identifiers that are secrets, credentials, or personal data are
/// still forbidden. See <c>docs/observability/index.md</c> §7 and §8.
/// </para>
/// </remarks>
public struct TailSampledTrace : IDisposable
{
    private readonly Activity? _activity;
    private readonly string _category;
    private readonly long _startedTimestamp;
    private readonly double _slowThresholdMs;
    private string _outcome;
    private bool _completed;

    private TailSampledTrace(Activity? activity, string category, double slowThresholdMs)
    {
        _activity = activity;
        _category = category;
        _startedTimestamp = Stopwatch.GetTimestamp();
        _slowThresholdMs = slowThresholdMs;
        _outcome = Outcomes.Failure;
        _completed = false;
    }

    /// <summary>
    /// True when this scope owns a real span. Callers can use it to skip building tag values that
    /// would otherwise be computed and thrown away.
    /// </summary>
    public bool IsRecording => _activity is not null;

    /// <summary>
    /// Starts a span if <paramref name="category"/> is enabled, or returns an inert scope.
    /// </summary>
    /// <param name="category">One of <see cref="TraceCategories"/>.</param>
    /// <param name="name">The span name. Must be a fixed string, never built from request data.</param>
    /// <param name="kind">The span kind.</param>
    /// <param name="slowThresholdMs">
    /// Duration at or above which the span is always retained, whatever the sample ratio.
    /// </param>
    public static TailSampledTrace Start(
        string category,
        string name,
        ActivityKind kind,
        double slowThresholdMs)
    {
        // IsEnabled, not ShouldTrace: the sample ratio is applied on the way out so that failures
        // and slow operations survive it.
        if (!TraceGate.Current.IsEnabled(category))
        {
            return new TailSampledTrace(null, category, slowThresholdMs);
        }

        var activity = FeatBitActivitySources.Service.StartActivity(name, kind);

        return new TailSampledTrace(activity, category, slowThresholdMs);
    }

    /// <summary>Adds a tag to the span. A no-op when the category is disabled.</summary>
    public readonly void SetTag(string key, object? value) => _activity?.SetTag(key, value);

    /// <summary>Marks the operation as successful.</summary>
    public void Success() => _outcome = Outcomes.Success;

    /// <summary>Marks the operation as successful, with an explicit reason.</summary>
    public void Success(string reason)
    {
        _outcome = Outcomes.Success;
        _activity?.SetTag(ObservabilityTags.Reason, reason);
    }

    /// <summary>Marks the operation as having ended in <paramref name="outcome"/>.</summary>
    /// <param name="outcome">One of <see cref="Outcomes"/>.</param>
    /// <param name="reason">A bounded reason value.</param>
    public void Ended(string outcome, string reason)
    {
        _outcome = outcome;
        _activity?.SetTag(ObservabilityTags.Reason, reason);
    }

    /// <summary>Marks the operation as failed and records the exception type — never the message.</summary>
    /// <remarks>
    /// The type is recorded rather than the message because an exception message routinely embeds
    /// the value that caused it, which may be a credential, an email address, or a connection
    /// string. The full exception is already in the log record this span correlates to.
    /// </remarks>
    public void Failed(Exception exception)
    {
        _outcome = Outcomes.Failure;
        _activity?.SetTag(ObservabilityTags.ErrorType, exception.GetType().Name);
    }

    /// <summary>Ends the span and applies the retention decision.</summary>
    public void Dispose()
    {
        if (_completed || _activity is null)
        {
            _completed = true;
            return;
        }

        _completed = true;

        var elapsedMs = Stopwatch.GetElapsedTime(_startedTimestamp).TotalMilliseconds;

        _activity.SetTag(ObservabilityTags.Outcome, _outcome);
        _activity.SetStatus(
            _outcome == Outcomes.Success ? ActivityStatusCode.Ok : ActivityStatusCode.Error);

        var retain = _outcome != Outcomes.Success
                     || elapsedMs >= _slowThresholdMs
                     || TraceGate.Current.ShouldTrace(_category);

        if (retain)
        {
            _activity.ActivityTraceFlags |= ActivityTraceFlags.Recorded;
        }

        _activity.Dispose();
    }
}
