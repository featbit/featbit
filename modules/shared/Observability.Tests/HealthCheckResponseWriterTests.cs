using System.Security.Claims;
using System.Text;
using System.Text.Json;
using FeatBit.Observability.AspNetCore;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace FeatBit.Observability.Tests;

/// <summary>
/// The <c>health/diagnostics</c> response writer.
/// </summary>
/// <remarks>
/// The endpoint is anonymous so that it is reachable during an incident without credentials, which
/// means its payload is the boundary. A check's structured data describes the deployment —
/// datacenter identity and reachability, leadership, the selected store — so it must not be served
/// to a caller who merely reached the port.
/// </remarks>
public class HealthCheckResponseWriterTests
{
    [Fact]
    public async Task WriteAsync_ForAnAnonymousCaller_WithholdsCheckDataAndDescription()
    {
        using var document = await WriteAsync(authenticated: false);
        var root = document.RootElement;

        Assert.True(root.GetProperty("detailRedacted").GetBoolean());

        var entry = root.GetProperty("entries").EnumerateArray().Single();
        Assert.Equal(0, entry.GetProperty("data").EnumerateObject().Count());
        Assert.Equal(JsonValueKind.Null, entry.GetProperty("description").ValueKind);

        // What is unhappy stays answerable without credentials; only why is withheld.
        Assert.Equal("control-plane", entry.GetProperty("name").GetString());
        Assert.Equal("Unhealthy", entry.GetProperty("status").GetString());
        Assert.Equal("Unhealthy", root.GetProperty("status").GetString());
    }

    [Fact]
    public async Task WriteAsync_ForAnAuthenticatedCaller_IncludesCheckDataAndDescription()
    {
        using var document = await WriteAsync(authenticated: true);
        var root = document.RootElement;

        Assert.False(root.GetProperty("detailRedacted").GetBoolean());

        var entry = root.GetProperty("entries").EnumerateArray().Single();
        Assert.Equal("dc-east", entry.GetProperty("data").GetProperty("localDataCenter").GetString());
        Assert.Equal("peer unreachable", entry.GetProperty("description").GetString());
    }

    [Fact]
    public async Task WriteAsync_NeverIncludesExceptionMessages()
    {
        // Driver exception text routinely embeds connection strings. The type identifies the
        // failure class; the message belongs only in the redacted, access-controlled logs.
        foreach (var authenticated in new[] { false, true })
        {
            using var document = await WriteAsync(authenticated);
            var body = document.RootElement.GetRawText();

            Assert.DoesNotContain("Password=hunter2", body, StringComparison.Ordinal);
            Assert.Contains("InvalidOperationException", body, StringComparison.Ordinal);
        }
    }

    private static async Task<JsonDocument> WriteAsync(bool authenticated)
    {
        var entry = new HealthReportEntry(
            HealthStatus.Unhealthy,
            description: "peer unreachable",
            duration: TimeSpan.FromMilliseconds(12),
            exception: new InvalidOperationException("Host=db;Password=hunter2"),
            data: new Dictionary<string, object>
            {
                ["localDataCenter"] = "dc-east",
                ["leaderInstanceId"] = "cp-7f4c",
            });

        var report = new HealthReport(
            new Dictionary<string, HealthReportEntry> { ["control-plane"] = entry },
            TimeSpan.FromMilliseconds(12));

        var context = new DefaultHttpContext();
        context.Response.Body = new MemoryStream();
        if (authenticated)
        {
            context.User = new ClaimsPrincipal(new ClaimsIdentity(
                [new Claim(ClaimTypes.Name, "operator")], authenticationType: "Test"));
        }

        await HealthCheckResponseWriter.WriteAsync(context, report);

        context.Response.Body.Position = 0;
        using var reader = new StreamReader(context.Response.Body, Encoding.UTF8);
        return JsonDocument.Parse(await reader.ReadToEndAsync());
    }
}
