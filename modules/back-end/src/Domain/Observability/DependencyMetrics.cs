#nullable enable

using System.Diagnostics.Metrics;

namespace Domain.Observability;

/// <summary>
/// Outbound dependency instrumentation for third-party HTTP services the API server calls.
/// </summary>
/// <remarks>
/// <para>
/// The billing service is an external system on the far side of the network, and every one of the
/// eleven methods that call it follows the same shape: <c>try</c>, call, <c>catch (Exception ex)</c>,
/// log, <c>return null</c>. A caller that gets <c>null</c> cannot tell "no subscription exists"
/// from "the billing service is down", and neither can any metric — the request completes 200 OK
/// with an empty result either way.
/// </para>
/// <para>
/// <b>These are recorded by a message handler on the HTTP client, not at the call sites.</b> That
/// choice matters for two reasons. It captures the real HTTP status code, which the catch blocks
/// throw away — a 402 from billing and a DNS failure are very different incidents and the catch
/// block renders them identically. And it cannot drift: a method added later is instrumented
/// automatically, whereas eleven hand-written call sites would have become ten the first time
/// somebody was in a hurry.
/// </para>
/// <para>
/// <b>Routes are not recorded, only the HTTP method.</b> Every billing route embeds a workspace ID,
/// so the path is unbounded. <c>destination</c> identifies the dependency and <c>reason</c> carries
/// the status class, which together answer "is this dependency healthy?" without a per-tenant
/// series.
/// </para>
/// </remarks>
public sealed class DependencyMetrics
{
    private DependencyMetrics(Meter meter, string instrumentPrefix)
    {
        Meter = meter;

        Requests = meter.CreateCounter<long>(
            $"{instrumentPrefix}dependency.requests",
            unit: "{request}",
            description:
            "Outbound requests to an external dependency, by destination, HTTP method and outcome. " +
            "reason carries the status class, which the calling code discards.");

        Duration = meter.CreateHistogram<double>(
            $"{instrumentPrefix}dependency.duration",
            unit: "ms",
            description:
            "Round-trip time of an outbound dependency request. Callers await these inline, so this " +
            "is latency a user is waiting on.");
    }

    /// <summary>The instrumentation in use for the running service.</summary>
    public static DependencyMetrics Current { get; } =
        new(new Meter(FeatBitMeters.Api), FeatBitInstruments.ApiPrefix);

    /// <summary>The owning meter. Exposed so tests can listen to this instance specifically.</summary>
    public Meter Meter { get; }

    /// <summary>Counter of outbound dependency requests.</summary>
    public Counter<long> Requests { get; }

    /// <summary>Distribution of outbound dependency round-trip times.</summary>
    public Histogram<double> Duration { get; }

    /// <summary>Records one outbound dependency request.</summary>
    /// <param name="destination">One of <see cref="DependencyNames"/>.</param>
    /// <param name="operation">The HTTP method, e.g. <c>GET</c>. Never the route.</param>
    /// <param name="outcome">One of <see cref="Outcomes"/>.</param>
    /// <param name="reason">One of <see cref="DependencyReasons"/>.</param>
    /// <param name="duration">The round-trip time.</param>
    public void RecordRequest(
        string destination,
        string operation,
        string outcome,
        string reason,
        TimeSpan duration)
    {
        var tags = new[]
        {
            new KeyValuePair<string, object?>(ObservabilityTags.Destination, destination),
            new KeyValuePair<string, object?>(ObservabilityTags.Operation, operation),
            new KeyValuePair<string, object?>(ObservabilityTags.Outcome, outcome),
            new KeyValuePair<string, object?>(ObservabilityTags.Reason, reason)
        };

        Requests.Add(1, tags);
        Duration.Record(duration.TotalMilliseconds, tags);
    }

    /// <summary>
    /// Maps an HTTP status code onto the bounded <see cref="DependencyReasons"/> vocabulary. The
    /// code itself is deliberately not a tag value — the status <i>class</i> is what drives the
    /// operational decision, and it keeps the series count fixed.
    /// </summary>
    public static string ReasonForStatus(int statusCode) => statusCode switch
    {
        >= 200 and < 300 => DependencyReasons.Ok,
        >= 300 and < 400 => DependencyReasons.Http3xx,
        >= 400 and < 500 => DependencyReasons.Http4xx,
        >= 500 => DependencyReasons.Http5xx,
        _ => DependencyReasons.TransportError
    };
}

/// <summary>The fixed vocabulary for the <c>destination</c> dimension of <see cref="DependencyMetrics"/>.</summary>
public static class DependencyNames
{
    /// <summary>The external billing and licensing service.</summary>
    public const string Billing = "billing";

    /// <summary>A relay proxy agent, called for availability checks and bootstrap/sync pushes.</summary>
    public const string Agent = "agent";

    /// <summary>An OIDC identity provider, called during single sign-on.</summary>
    public const string Oidc = "oidc";

    /// <summary>An OAuth identity provider, called during single sign-on.</summary>
    public const string OAuth = "oauth";

    /// <summary>The ClickHouse OLAP endpoint, called over HTTP for analytics queries.</summary>
    public const string ClickHouse = "clickhouse";
}

/// <summary>The fixed <c>reason</c> vocabulary for <see cref="DependencyMetrics"/>.</summary>
public static class DependencyReasons
{
    /// <summary>A 2xx response.</summary>
    public const string Ok = "ok";

    /// <summary>A 3xx response that was surfaced rather than followed.</summary>
    public const string Http3xx = "http_3xx";

    /// <summary>A 4xx response. Usually our request is wrong, or the resource does not exist.</summary>
    public const string Http4xx = "http_4xx";

    /// <summary>A 5xx response. The dependency is broken.</summary>
    public const string Http5xx = "http_5xx";

    /// <summary>The request exceeded the client timeout or was canceled.</summary>
    public const string Timeout = "timeout";

    /// <summary>No response was obtained — DNS, TLS, or connection failure.</summary>
    public const string TransportError = "transport_error";
}
