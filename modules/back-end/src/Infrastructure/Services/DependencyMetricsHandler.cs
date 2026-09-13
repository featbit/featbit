#nullable enable

using System.Diagnostics;
using Domain.Observability;

namespace Infrastructure.Services;

/// <summary>
/// Records <see cref="DependencyMetrics"/> for every request made through the HTTP client it is
/// attached to.
/// </summary>
/// <remarks>
/// <para>
/// Attached per client rather than applied globally, so it cannot double-count outbound calls that
/// other components already measure for themselves — webhook deliveries in particular have their
/// own instrumentation with its own retry semantics, and are deliberately not routed through here.
/// Each client supplies its own <c>destination</c> from the closed
/// <see cref="DependencyNames"/> vocabulary, which is what keeps the dimension bounded.
/// </para>
/// <para>
/// <b>Instrumentation must never change what the caller sees.</b> The response is returned and any
/// exception rethrown exactly as received; the handler only observes. A non-success status code is
/// recorded and passed through untouched, because <c>SendAsync</c> does not throw on one and the
/// calling code decides what to do about it.
/// </para>
/// </remarks>
public sealed class DependencyMetricsHandler(string destination) : DelegatingHandler
{
    protected override async Task<HttpResponseMessage> SendAsync(
        HttpRequestMessage request,
        CancellationToken cancellationToken)
    {
        var operation = request.Method.Method;
        var start = Stopwatch.GetTimestamp();

        try
        {
            var response = await base.SendAsync(request, cancellationToken);

            var statusCode = (int)response.StatusCode;
            DependencyMetrics.Current.RecordRequest(
                destination,
                operation,
                response.IsSuccessStatusCode ? Outcomes.Success : Outcomes.Failure,
                DependencyMetrics.ReasonForStatus(statusCode),
                Stopwatch.GetElapsedTime(start));

            return response;
        }
        catch (TaskCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            // HttpClient surfaces its own timeout as a cancellation that the caller never asked
            // for. Recording it as a timeout rather than a cancellation is what makes a saturated
            // dependency distinguishable from a client that gave up.
            DependencyMetrics.Current.RecordRequest(
                destination,
                operation,
                Outcomes.Timeout,
                DependencyReasons.Timeout,
                Stopwatch.GetElapsedTime(start));
            throw;
        }
        catch (Exception)
        {
            DependencyMetrics.Current.RecordRequest(
                destination,
                operation,
                Outcomes.Failure,
                DependencyReasons.TransportError,
                Stopwatch.GetElapsedTime(start));
            throw;
        }
    }
}
