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

        var payload = new
        {
            status = report.Status.ToString(),
            totalDurationMs = Math.Round(report.TotalDuration.TotalMilliseconds, 2),
            entries = report.Entries.Select(entry => new
            {
                name = entry.Key,
                status = entry.Value.Status.ToString(),
                durationMs = Math.Round(entry.Value.Duration.TotalMilliseconds, 2),
                description = entry.Value.Description,
                tags = entry.Value.Tags,
                exception = entry.Value.Exception?.GetType().Name,
                data = entry.Value.Data
            })
        };

        return context.Response.WriteAsync(JsonSerializer.Serialize(payload, SerializerOptions));
    }
}
