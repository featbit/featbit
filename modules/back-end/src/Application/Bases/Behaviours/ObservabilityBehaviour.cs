using System.Diagnostics;
using Domain.Observability;

namespace Application.Bases.Behaviours;

/// <summary>
/// Records duration and outcome for every MediatR request, tagged by request type.
/// </summary>
/// <remarks>
/// <para>
/// This is the broadest application-level latency signal either service has. HTTP server metrics
/// measure the endpoint, which conflates the handler with model binding, auth, and serialization;
/// this measures the handler alone, so a slow command is attributable to the command rather than to
/// "the API is slow".
/// </para>
/// <para>
/// <b>Registration order matters.</b> This behavior is registered <i>after</i>
/// <see cref="ValidationBehaviour{TRequest,TResponse}"/>, so validation runs first and its rejections
/// are recorded here as <c>validation_failed</c> rather than being timed as handler work. Validation
/// semantics are untouched: this behavior only observes the exception on its way past.
/// </para>
/// <para>
/// <b>The instruments live on <see cref="RequestMetrics"/>, not here.</b> This is a generic type, so
/// static instruments on it would be created once per closed generic and would bake in a meter name
/// that is wrong for whichever of the two hosts did not write it. See the remarks on
/// <see cref="RequestMetrics"/>.
/// </para>
/// </remarks>
public class ObservabilityBehaviour<TRequest, TResponse> : IPipelineBehavior<TRequest, TResponse>
    where TRequest : notnull
{
    private static readonly string RequestName = typeof(TRequest).Name;

    public async Task<TResponse> Handle(
        TRequest request,
        RequestHandlerDelegate<TResponse> next,
        CancellationToken cancellationToken)
    {
        var startedTimestamp = Stopwatch.GetTimestamp();
        var outcome = Outcomes.Failure;

        try
        {
            var response = await next(cancellationToken);
            outcome = Outcomes.Success;
            return response;
        }
        catch (ValidationException)
        {
            // A rejected request is not a server fault, and folding it into the failure rate would
            // make a client sending bad input look like an outage.
            outcome = ValidationFailedOutcome;
            throw;
        }
        catch (OperationCanceledException)
        {
            // Almost always the caller disconnecting. Counted separately so it cannot inflate the
            // error rate, and kept rather than dropped because a spike in cancellations is itself a
            // symptom of the handler being too slow.
            outcome = CancelledOutcome;
            throw;
        }
        finally
        {
            RequestMetrics.Current.Record(
                RequestName, outcome, Stopwatch.GetElapsedTime(startedTimestamp));
        }
    }

    /// <summary>Outcome recorded when the request was rejected by validation.</summary>
    public const string ValidationFailedOutcome = RequestMetrics.ValidationFailedOutcome;

    /// <summary>Outcome recorded when the request was canceled, usually by the caller.</summary>
    public const string CancelledOutcome = RequestMetrics.CancelledOutcome;
}
