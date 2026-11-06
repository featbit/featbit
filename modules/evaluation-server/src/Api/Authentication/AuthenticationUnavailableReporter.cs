namespace Api.Authentication;

/// <summary>
/// Reports authentication outages at most once every five seconds per instance.
/// </summary>
public sealed class AuthenticationUnavailableReporter(
    ILogger<AuthenticationUnavailableReporter> logger,
    TimeProvider timeProvider)
{
    private static readonly TimeSpan Interval = TimeSpan.FromSeconds(5);

    private readonly Lock _gate = new();
    private long? _lastReported;

    public void Report(string scheme, string? path, string traceId)
    {
        lock (_gate)
        {
            var now = timeProvider.GetTimestamp();
            if (_lastReported is { } previous && timeProvider.GetElapsedTime(previous, now) < Interval)
            {
                return;
            }

            _lastReported = now;
        }

        logger.LogError(
            "Authentication unavailable (Logging is limited to once every 5 seconds per instance). Scheme: {Scheme}; Path: {Path}; TraceId: {TraceId}",
            scheme, path, traceId
        );
    }
}
