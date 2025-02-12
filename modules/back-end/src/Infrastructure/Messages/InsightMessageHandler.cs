using Domain.Messages;
using Microsoft.Extensions.Logging;

namespace Infrastructure.Messages;

public class InsightMessageHandler : IMessageHandler, IDisposable
{
    public string Topic => Topics.Insights;

    private readonly List<object> _eventsBuffer;

    private readonly IInsightService _insightService;
    private readonly PeriodicTimer _timer;
    private readonly Task _flushWorker;

    private readonly ILogger<InsightMessageHandler> _logger;

    public InsightMessageHandler(IInsightService insightService, ILogger<InsightMessageHandler> logger)
    {
        _insightService = insightService;
        _logger = logger;
        
        _eventsBuffer = [];
        _timer = new PeriodicTimer(TimeSpan.FromMilliseconds(250));
        _flushWorker = FlushEventsAsync();
    }

    public Task HandleAsync(string message, CancellationToken cancellationToken)
    {
        if (_insightService.TryParse(message, out var @event))
        {
            // Add event to buffer
            _eventsBuffer.Add(@event);
        }

        return Task.CompletedTask;
    }

    private async Task FlushEventsAsync()
    {
        _logger.LogDebug("Start Flushing events.");
        try
        {
            while (await _timer.WaitForNextTickAsync())
            {
                if (_eventsBuffer.Count == 0)
                {
                    // If there are no events in the buffer, continue to wait for the next tick.
                    continue;
                }

                // Get snapshots of the events and clear the buffer.
                var snapshots = _eventsBuffer.ToArray();
                _eventsBuffer.Clear();

                // Split each snapshot into groups of 100
                foreach (var chunked in snapshots.Chunk(100))
                {
                    await _insightService.AddManyAsync(chunked);
                }

                // Check log level here to avoid unnecessary memory allocation
                if (_logger.IsEnabled(LogLevel.Debug))
                {
                    _logger.LogDebug("{Count} insight events has been handled", snapshots.Length);
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Exception occurred while flushing insight events.");
        }
    }

    public void Dispose()
    {
        // stop the timer
        _timer.Dispose();

        // wait 1 second to flush events
        _flushWorker.Wait(TimeSpan.FromSeconds(1));
        _flushWorker.Dispose();

        GC.SuppressFinalize(this);
    }
}