using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace FeatBit.Observability.AspNetCore;

/// <summary>
/// JSON response writer for <c>health/diagnostics</c>.
/// </summary>
/// <remarks>
/// <para>
/// The default health-check response writer emits nothing but the aggregate status word, which is
/// the right answer for a probe and a useless one for an operator: it cannot say WHICH dependency
/// is unhappy. Because <c>health/diagnostics</c> gates nothing, it can afford to answer properly —
/// per-check status, duration, description, and the check's own structured data.
/// </para>
/// <para>
/// Exception <b>messages</b> are deliberately excluded and only the exception TYPE is reported.
/// Driver-level exception text routinely embeds connection strings, bootstrap server lists, and
/// authentication principals, and this endpoint exists to be read by humans — the one place where
/// a leaked credential is most likely to be copied somewhere else. The type name is what identifies
/// the failure class; the full exception is already in the logs, which are redacted and access
/// controlled.
/// </para>
/// <para>
/// <b>Structured check data is withheld from an unauthenticated caller.</b> The endpoint stays
/// anonymous because it has to be reachable without credentials to be worth anything during an
/// incident, but its <c>data</c> payload is where a check describes the deployment — datacenter
/// identifiers and reachability, which datacenter is local, leadership state and the leader's
/// instance id, the selected store, broker detail. That is internal topology, and anyone able to
/// reach the port could otherwise enumerate it. Status, duration, and tags stay visible to every
/// caller, so the endpoint still answers <i>what</i> is unhappy; the detail of <i>why</i> requires
/// authentication.
/// </para>
/// </remarks>
public static class HealthCheckResponseWriter
{
    private static readonly JsonSerializerOptions SerializerOptions = new()
    {
        WriteIndented = true
    };

    public static Task WriteAsync(HttpContext context, HealthReport report)
    {
        context.Response.ContentType = "application/json; charset=utf-8";

        var authenticated = context.User.Identity?.IsAuthenticated == true;

        return context.Response.WriteAsync(
            JsonSerializer.Serialize(Build(report, authenticated), SerializerOptions));
    }

    /// <summary>
    /// Shapes the response. <paramref name="includeDetail"/> gates the per-check description and
    /// structured data. It is a parameter rather than a read of the context so that the redaction
    /// rule can be tested without standing up an HTTP pipeline.
    /// </summary>
    internal static object Build(HealthReport report, bool includeDetail) => new
    {
        status = report.Status.ToString(),
        totalDurationMs = Math.Round(report.TotalDuration.TotalMilliseconds, 2),
        detailRedacted = !includeDetail,
        entries = report.Entries.Select(entry => new
        {
            name = entry.Key,
            status = entry.Value.Status.ToString(),
            durationMs = Math.Round(entry.Value.Duration.TotalMilliseconds, 2),
            description = includeDetail ? entry.Value.Description : null,
            tags = entry.Value.Tags,
            exception = entry.Value.Exception?.GetType().Name,
            data = includeDetail ? entry.Value.Data : EmptyData
        })
    };

    /// <summary>
    /// Stands in for a redacted <c>data</c> payload. An empty object rather than <c>null</c> keeps
    /// the response shape identical for both callers, so a consumer never has to special-case the
    /// anonymous form.
    /// </summary>
    private static readonly IReadOnlyDictionary<string, object> EmptyData =
        new Dictionary<string, object>();
}
