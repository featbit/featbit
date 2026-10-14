using Domain.Observability;

namespace Api.Setup;

/// <summary>
/// Writes the current trace identifier to a response header, so a caller reporting a problem can
/// quote an identifier that leads straight to the server-side logs for that exact request.
/// </summary>
public static class TraceResponseHeaderExtensions
{
    /// <summary>Response header carrying the trace identifier.</summary>
    public const string HeaderName = "x-trace-id";

    /// <summary>
    /// Adds the trace-identifier response header. Register first, so the header is present on error
    /// responses produced by the exception handler as well as on successful ones.
    /// </summary>
    /// <remarks>
    /// <para>
    /// Only a header is added. Error response <i>bodies</i> are part of the API contract and are
    /// deliberately left untouched.
    /// </para>
    /// <para>
    /// The identifier is read when the request enters the pipeline and captured, rather than read
    /// inside the callback: the callback runs as the response begins, at which point the ambient
    /// activity is not guaranteed to still be the request's.
    /// </para>
    /// </remarks>
    public static IApplicationBuilder UseTraceResponseHeader(this IApplicationBuilder app)
        => app.Use(async (context, next) =>
        {
            var traceId = ActivityCorrelation.TraceId;
            if (traceId is not null)
            {
                context.Response.OnStarting(static state =>
                {
                    var (response, id) = ((HttpResponse, string))state;
                    if (!response.Headers.ContainsKey(HeaderName))
                    {
                        response.Headers[HeaderName] = id;
                    }

                    return Task.CompletedTask;
                }, (context.Response, traceId));
            }

            await next(context);
        });
}
