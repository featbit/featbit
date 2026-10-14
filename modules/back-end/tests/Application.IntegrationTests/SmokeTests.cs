using System.Net;

namespace Application.IntegrationTests;

[Trait("Category", "Host")]
[Collection(nameof(TestApp))]
public class SmokeTests
{
    private readonly TestApp _app;

    public SmokeTests(TestApp app)
    {
        _app = app;
    }

    [Fact]
    public async Task LivenessEndpoint_ServerStarted_Returns200Ok()
    {
        var client = _app.CreateClient();
        var response = await client.GetAsync("/health/liveness");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task StartupEndpoint_WhenRequested_IsMapped()
    {
        var client = _app.CreateClient();
        var response = await client.GetAsync("/health/startup");

        // The verdict depends on whether the test host's dependencies are reachable; what this pins
        // is that the route exists, so an orchestrator pointing a startup probe at it gets a health
        // verdict rather than a 404 that would be read as a crash-looping pod.
        Assert.NotEqual(HttpStatusCode.NotFound, response.StatusCode);
        Assert.NotEqual(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task DiagnosticsEndpoint_WhenRequested_ReturnsAStructuredJsonReport()
    {
        var client = _app.CreateClient();
        var response = await client.GetAsync("/health/diagnostics");

        Assert.NotEqual(HttpStatusCode.NotFound, response.StatusCode);
        Assert.NotEqual(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Equal("application/json", response.Content.Headers.ContentType?.MediaType);

        var body = await response.Content.ReadAsStringAsync();

        // The custom writer is the whole point of this endpoint: the default writer emits a single
        // status word, which cannot tell an operator WHICH dependency is unhappy.
        Assert.Contains("\"status\"", body);
        Assert.Contains("\"entries\"", body);
    }

    [Fact]
    public async Task DiagnosticsEndpoint_WhenRequested_ExcludesReadinessChecks()
    {
        var client = _app.CreateClient();
        var response = await client.GetAsync("/health/diagnostics");

        var body = await response.Content.ReadAsStringAsync();

        // Tag filtering, asserted end to end. A readiness check leaking onto this endpoint would
        // mean the reverse leak is possible too, and that one pulls pods out of rotation.
        Assert.DoesNotContain("Kafka Producer Cluster", body);
        Assert.DoesNotContain("Kafka Consumer Cluster", body);
    }

    [Fact]
    public async Task ReadinessEndpoint_AfterTheDiagnosticsAddition_IsUnchanged()
    {
        var client = _app.CreateClient();
        var response = await client.GetAsync("/health/readiness");

        // Readiness keeps the DEFAULT response writer — a bare status word. If the diagnostics
        // writer had been attached here by mistake, this body would be JSON, and anything parsing
        // readiness output would break on upgrade.
        var body = await response.Content.ReadAsStringAsync();

        Assert.DoesNotContain("\"entries\"", body);
        Assert.DoesNotContain("application/json", response.Content.Headers.ContentType?.MediaType ?? string.Empty);
    }
}
