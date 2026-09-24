using System.Net;
using Domain.Observability;
using FeatBit.Observability.TestKit;
using Infrastructure.Services;

namespace Infrastructure.UnitTests.Services;

/// <summary>
/// Covers <see cref="DependencyMetricsHandler"/> itself, rather than the
/// <see cref="DependencyMetrics"/> primitive it writes to.
/// </summary>
/// <remarks>
/// <para>
/// The handler was originally attached to a single client, and only the primitive was tested. It is
/// now attached to several — billing, relay proxy agents, the two SSO clients, and ClickHouse — so
/// the translation it performs (HTTP outcome to <c>outcome</c>/<c>reason</c>) is load-bearing for
/// every outbound call the API makes, not just for one.
/// </para>
/// <para>
/// <b>The timeout case is the one that cannot be reached through the primitive.</b>
/// <see cref="HttpClient"/> surfaces its own timeout as a <see cref="TaskCanceledException"/> that
/// the caller never requested, which is indistinguishable from a genuine cancellation unless
/// something inspects the token. Recording it as <c>timeout</c> is what makes a saturated
/// dependency tellable apart from a client that gave up, and nothing else asserts it.
/// </para>
/// <para>
/// No collection attribute is needed: <see cref="DependencyMetrics.Current"/> is process-wide, but
/// this is the only class in this assembly that touches it, and xUnit runs the tests within a
/// single class sequentially.
/// </para>
/// </remarks>
public sealed class DependencyMetricsHandlerTests
{
    private static HttpClient CreateSut(HttpMessageHandler inner, out DependencyMetrics metrics)
    {
        metrics = DependencyMetrics.Current;

        var handler = new DependencyMetricsHandler(DependencyNames.Agent)
        {
            InnerHandler = inner
        };

        return new HttpClient(handler);
    }

    [Fact]
    public async Task SendAsync_WhenTheDependencyReturnsAnError_RecordsTheStatusClassAndPassesItThrough()
    {
        // Arrange
        var client = CreateSut(new StubHandler(HttpStatusCode.InternalServerError), out var metrics);
        using var collector = new MetricCollector(metrics.Meter);

        // Act
        var response = await client.GetAsync("https://agent.invalid/health/liveness");

        // Assert
        // The handler observes only: a non-success status must reach the caller untouched, because
        // SendAsync does not throw on one and the calling code decides what to do about it.
        Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);

        var request = Assert.Single(collector.For("dependency.requests"));
        Assert.Equal(DependencyNames.Agent, request.Tag(ObservabilityTags.Destination));
        Assert.Equal("GET", request.Tag(ObservabilityTags.Operation));
        Assert.Equal(Outcomes.Failure, request.Tag(ObservabilityTags.Outcome));
        Assert.Equal(DependencyReasons.Http5xx, request.Tag(ObservabilityTags.Reason));

        var duration = Assert.Single(collector.For("dependency.duration"));
        Assert.Equal("ms", duration.Unit);
    }

    [Fact]
    public async Task SendAsync_WhenTheDependencySucceeds_RecordsSuccess()
    {
        // Arrange
        var client = CreateSut(new StubHandler(HttpStatusCode.OK), out var metrics);
        using var collector = new MetricCollector(metrics.Meter);

        // Act
        await client.GetAsync("https://agent.invalid/health/liveness");

        // Assert
        var request = Assert.Single(collector.For("dependency.requests"));
        Assert.Equal(Outcomes.Success, request.Tag(ObservabilityTags.Outcome));
        Assert.Equal(DependencyReasons.Ok, request.Tag(ObservabilityTags.Reason));
    }

    [Fact]
    public async Task SendAsync_WhenTheClientTimesOut_RecordsATimeoutRatherThanACancellation()
    {
        // Arrange
        // A TaskCanceledException raised while the caller's token is NOT cancelled is how
        // HttpClient reports its own timeout.
        var client = CreateSut(new ThrowingHandler(new TaskCanceledException()), out var metrics);
        using var collector = new MetricCollector(metrics.Meter);

        // Act
        await Assert.ThrowsAsync<TaskCanceledException>(
            () => client.GetAsync("https://agent.invalid/health/liveness"));

        // Assert
        var request = Assert.Single(collector.For("dependency.requests"));
        Assert.Equal(Outcomes.Timeout, request.Tag(ObservabilityTags.Outcome));
        Assert.Equal(DependencyReasons.Timeout, request.Tag(ObservabilityTags.Reason));
    }

    [Fact]
    public async Task SendAsync_WhenTheCallerCancels_DoesNotReportItAsADependencyTimeout()
    {
        // Arrange
        // The caller gave up. Attributing that to the dependency would manufacture an outage.
        using var cancellation = new CancellationTokenSource();
        await cancellation.CancelAsync();

        var client = CreateSut(new ThrowingHandler(new TaskCanceledException()), out var metrics);
        using var collector = new MetricCollector(metrics.Meter);

        // Act
        await Assert.ThrowsAnyAsync<OperationCanceledException>(
            () => client.GetAsync("https://agent.invalid/health/liveness", cancellation.Token));

        // Assert
        var request = Assert.Single(collector.For("dependency.requests"));
        Assert.NotEqual(Outcomes.Timeout, request.Tag(ObservabilityTags.Outcome));
    }

    [Fact]
    public async Task SendAsync_WhenTheTransportFails_RecordsATransportErrorAndRethrows()
    {
        // Arrange
        var client = CreateSut(new ThrowingHandler(new HttpRequestException("no route")), out var metrics);
        using var collector = new MetricCollector(metrics.Meter);

        // Act
        await Assert.ThrowsAsync<HttpRequestException>(
            () => client.GetAsync("https://agent.invalid/health/liveness"));

        // Assert
        var request = Assert.Single(collector.For("dependency.requests"));
        Assert.Equal(Outcomes.Failure, request.Tag(ObservabilityTags.Outcome));
        Assert.Equal(DependencyReasons.TransportError, request.Tag(ObservabilityTags.Reason));
    }

    private sealed class StubHandler(HttpStatusCode statusCode) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken)
            => Task.FromResult(new HttpResponseMessage(statusCode));
    }

    private sealed class ThrowingHandler(Exception exception) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken)
            => throw exception;
    }
}
