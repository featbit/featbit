using System.Diagnostics;
using Domain.Observability;
using Serilog.Core;
using Serilog.Events;

namespace Api.Setup;

/// <summary>
/// Adds <see cref="CorrelationFields.TraceId"/>, <see cref="CorrelationFields.SpanId"/>, and — when
/// one is in scope — <see cref="CorrelationFields.ChangeId"/> to every log event.
/// </summary>
/// <remarks>
/// <para>
/// The OpenTelemetry sink can attach trace identifiers by itself, but only to what it exports, and
/// only when it is switched on. Enriching instead puts the identifiers on the <i>log event</i>, so
/// they reach every sink — including the console sink, which is the only one configured by default
/// and therefore the one an operator actually reads during an incident.
/// </para>
/// <para>
/// Both console sinks in this repository use <c>CompactJsonFormatter</c>, which writes every
/// property as a JSON field, so no output-template change is needed for these to appear.
/// </para>
/// <para>
/// Identifiers only exist while something is listening for activities; see
/// <see cref="ActivityCorrelation.EnsureListener"/>. When no activity is in scope — during startup,
/// or on a background worker that has not opened one — the fields are omitted rather than written
/// empty, so a missing value is unambiguous.
/// </para>
/// </remarks>
public sealed class TraceContextEnricher : ILogEventEnricher
{
    /// <summary>Adds the correlation fields to <paramref name="logEvent"/>.</summary>
    public void Enrich(LogEvent logEvent, ILogEventPropertyFactory propertyFactory)
    {
        var activity = Activity.Current;
        if (activity is null)
        {
            return;
        }

        var traceId = ActivityCorrelation.TraceIdOf(activity);
        if (traceId is not null)
        {
            logEvent.AddPropertyIfAbsent(propertyFactory.CreateProperty(CorrelationFields.TraceId, traceId));
        }

        var spanId = ActivityCorrelation.SpanIdOf(activity);
        if (spanId is not null)
        {
            logEvent.AddPropertyIfAbsent(propertyFactory.CreateProperty(CorrelationFields.SpanId, spanId));
        }

        var changeId = activity.GetBaggageItem(CorrelationFields.ChangeId);
        if (!string.IsNullOrEmpty(changeId))
        {
            logEvent.AddPropertyIfAbsent(propertyFactory.CreateProperty(CorrelationFields.ChangeId, changeId));
        }
    }
}
