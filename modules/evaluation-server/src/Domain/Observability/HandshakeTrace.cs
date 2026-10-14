#nullable enable

using System.Diagnostics;

namespace Domain.Observability;

/// <summary>
/// T2 — a span covering one WebSocket handshake: validate, then accept or reject.
/// </summary>
/// <remarks>
/// <para>
/// <b>The span ends at the handshake, not at the disconnect.</b> A streaming connection lives for
/// hours, and a span open that long is useless for latency analysis, holds context for its whole
/// lifetime, and arrives in the backend far too late to help with the incident it belongs to. The
/// connection's lifetime is covered by <c>streaming.connection_duration</c>, which is a metric and
/// costs nothing to keep open.
/// </para>
/// <para>
/// <b>Sampling is decided at the end, not the beginning.</b> The interesting handshakes are the
/// rejected ones and the slow ones, and neither is knowable when the span starts. So the span is
/// created whenever the category is enabled, and the <see cref="ActivityTraceFlags.Recorded"/> flag
/// — which is what exporters honor — is set on the way out: always for a rejection or a slow
/// handshake, and otherwise only if the sample ratio says so. Sampling up front would discard
/// exactly the handshakes worth keeping.
/// </para>
/// <para>
/// No token, query string, or client address is ever put on this span. The connection type is
/// normalized through <see cref="StreamingMetrics.Normalize"/> for the same reason it is on the
/// metric: it originates in a caller-supplied query parameter.
/// </para>
/// </remarks>
public struct HandshakeTrace : IDisposable
{
    /// <summary>
    /// Handshakes at or above this duration are always retained, regardless of the sample ratio.
    /// </summary>
    /// <remarks>
    /// A handshake performs a credential lookup against the store. A second is far beyond what that
    /// should ever take, so anything at or above it is by definition an outlier worth keeping.
    /// </remarks>
    public const double SlowHandshakeThresholdMs = 1_000d;

    private readonly Activity? _activity;
    private readonly long _startedTimestamp;
    private string _outcome;
    private bool _completed;

    private HandshakeTrace(Activity? activity)
    {
        _activity = activity;
        _startedTimestamp = Stopwatch.GetTimestamp();
        _outcome = Outcomes.Failure;
        _completed = false;
    }

    /// <summary>
    /// Starts a handshake span if the <see cref="TraceCategories.StreamingHandshake"/> category is
    /// enabled. Returns an inert scope otherwise.
    /// </summary>
    public static HandshakeTrace Start(string connectionType)
    {
        // IsEnabled, not ShouldTrace: the sample ratio is applied on the way out so that rejections
        // and slow handshakes survive it. See the type remarks.
        if (!TraceGate.Current.IsEnabled(TraceCategories.StreamingHandshake))
        {
            return new HandshakeTrace(null);
        }

        var activity = FeatBitActivitySources.Service.StartActivity(
            "streaming.handshake", ActivityKind.Server);

        activity?.SetTag(
            ObservabilityTags.ConnectionType, StreamingMetrics.Normalize(connectionType));

        return new HandshakeTrace(activity);
    }

    /// <summary>Marks the handshake as rejected, with a reason from <see cref="StreamingReasons"/>.</summary>
    public void Rejected(string reason)
    {
        _outcome = Outcomes.Rejected;
        _activity?.SetTag(ObservabilityTags.Reason, reason);
    }

    /// <summary>Marks the handshake as accepted.</summary>
    public void Accepted()
    {
        _outcome = Outcomes.Success;
        _activity?.SetTag(ObservabilityTags.Reason, StreamingReasons.Accepted);
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
                     || elapsedMs >= SlowHandshakeThresholdMs
                     || TraceGate.Current.ShouldTrace(TraceCategories.StreamingHandshake);

        if (retain)
        {
            _activity.ActivityTraceFlags |= ActivityTraceFlags.Recorded;
        }

        _activity.Dispose();
    }
}
