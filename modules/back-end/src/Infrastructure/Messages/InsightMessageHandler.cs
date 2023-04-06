using System.Text.Json.Nodes;
using Domain.Messages;
using Microsoft.Extensions.Logging;
using MongoDB.Bson;
using MongoDB.Driver;
using Newtonsoft.Json;

namespace Infrastructure.Messages;

public class InsightMessageHandler : IMessageHandler, IDisposable
{
    public string Topic => Topics.Insights;

    private readonly IMongoCollection<BsonDocument> _events;
    private readonly List<BsonDocument> _eventsBuffer;

    private readonly PeriodicTimer _timer;
    private readonly Task _flushWorker;

    private readonly ILogger<InsightMessageHandler> _logger;

    public InsightMessageHandler(MongoDbClient mongodb, ILogger<InsightMessageHandler> logger)
    {
        _events = mongodb.CollectionOf("Events");
        _eventsBuffer = new List<BsonDocument>();

        _logger = logger;

        _timer = new PeriodicTimer(TimeSpan.FromSeconds(1));
        _flushWorker = FlushEventsAsync();
    }

    public Task HandleAsync(string message, CancellationToken cancellationToken)
    {
        try
        {
            var jsonNode = JsonNode.Parse(message)!.AsObject();

            // replace uuid with _id
            jsonNode["_id"] = jsonNode["uuid"];
            jsonNode.Remove("uuid");

            var timestampInMilliseconds = jsonNode["timestamp"]!.GetValue<long>() / 1000;
            jsonNode["timestamp"] = DateTimeOffset.FromUnixTimeMilliseconds(timestampInMilliseconds).UtcDateTime;

            var bsonDocument = jsonNode.ToBsonDocument();
            _eventsBuffer.Add(bsonDocument);
        }
        catch (JsonException)
        {
            // ignore invalid json
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
                    await _events.InsertManyAsync(chunked);
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