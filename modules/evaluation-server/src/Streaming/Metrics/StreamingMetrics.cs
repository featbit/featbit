using System.Diagnostics.Metrics;
using Microsoft.Extensions.Logging;

namespace Streaming.Metrics;

public class StreamingMetrics : IStreamingMetrics
{
    private readonly Meter _meter;
    private readonly ILogger<StreamingMetrics> _logger;

    // Connection instruments
    private readonly Counter<long> _totalConnections;
    private readonly UpDownCounter<long> _activeConnections;
    private readonly Counter<long> _connectionErrors;
    private readonly Counter<long> _connectionRejections;
    private readonly Histogram<double> _connectionDuration;

    // Message instruments
    private readonly Counter<long> _messagesProcessed;
    private readonly Histogram<long> _messageSize;
    private readonly Histogram<double> _messageProcessingDuration;

    public StreamingMetrics(ILogger<StreamingMetrics> logger, IMeterFactory meterFactory)
    {
        _logger = logger;
        _meter = meterFactory.Create("FeatBit.Evaluation.Streaming");

        // Connection instruments
        _totalConnections = _meter.CreateCounter<long>(
            "websocket.connections.total",
            description: "Total number of WebSocket connections established"
        );

        _activeConnections = _meter.CreateUpDownCounter<long>(
            "websocket.connections.active",
            description: "Number of currently active WebSocket connections"
        );

        _connectionErrors = _meter.CreateCounter<long>(
            "websocket.connections.errors",
            description: "Total number of WebSocket connection errors"
        );

        _connectionRejections = _meter.CreateCounter<long>(
            "websocket.connections.rejections",
            description: "Total number of rejected WebSocket connections"
        );

        _connectionDuration = _meter.CreateHistogram<double>(
            "websocket.connections.duration",
            unit: "s",
            description: "Duration of WebSocket connections"
        );

        // Message instruments
        _messagesProcessed = _meter.CreateCounter<long>(
            "websocket.messages.processed",
            description: "Total number of WebSocket messages processed"
        );

        _messageSize = _meter.CreateHistogram<long>(
            "websocket.messages.size",
            unit: "By",
            description: "Size of WebSocket messages"
        );

        _messageProcessingDuration = _meter.CreateHistogram<double>(
            "websocket.messages.duration",
            unit: "s",
            description: "Duration of message processing"
        );

        _logger.LogInformation("StreamingMetrics initialized with meter name: {MeterName}", _meter.Name);
    }

    // Connection tracking methods
    public void ConnectionEstablished(string type)
    {
        _logger.LogInformation("Recording connection established of type: {Type}", type);
        _totalConnections.Add(1, new KeyValuePair<string, object?>("type", type));
        _activeConnections.Add(1);
    }

    public void ConnectionClosed(long durationMs)
    {
        _logger.LogInformation("Recording connection closed with duration: {DurationMs}ms", durationMs);
        _activeConnections.Add(-1);
        _connectionDuration.Record(durationMs / 1000.0);
    }

    public void ConnectionRejected(string reason)
    {
        _logger.LogInformation("Recording connection rejected with reason: {Reason}", reason);
        _connectionRejections.Add(1, new KeyValuePair<string, object?>("reason", reason));
    }

    public void ConnectionError(string errorType)
    {
        _logger.LogInformation("Recording connection error of type: {ErrorType}", errorType);
        _connectionErrors.Add(1, new KeyValuePair<string, object?>("error_type", errorType));
    }

    // Message tracking methods
    public IDisposable TrackMessageProcessing(string messageType, int messageSizeBytes)
    {
        _logger.LogInformation("Recording message processing - Type: {MessageType}, Size: {SizeBytes} bytes", messageType, messageSizeBytes);
        _messagesProcessed.Add(1, new KeyValuePair<string, object?>("type", messageType));
        _messageSize.Record(messageSizeBytes, new KeyValuePair<string, object?>("type", messageType));
        
        var startTime = DateTime.UtcNow;
        return new MessageProcessingTimer(this, messageType, startTime, _logger);
    }

    internal void RecordMessageProcessingDuration(string messageType, DateTime startTime)
    {
        var duration = (DateTime.UtcNow - startTime).TotalSeconds;
        _logger.LogInformation("Recording message processing duration - Type: {MessageType}, Duration: {Duration}s", messageType, duration);
        _messageProcessingDuration.Record(duration, new KeyValuePair<string, object?>("type", messageType));
    }

    private class MessageProcessingTimer : IDisposable
    {
        private readonly StreamingMetrics _metrics;
        private readonly string _messageType;
        private readonly DateTime _startTime;
        private readonly ILogger _logger;

        public MessageProcessingTimer(StreamingMetrics metrics, string messageType, DateTime startTime, ILogger logger)
        {
            _metrics = metrics;
            _messageType = messageType;
            _startTime = startTime;
            _logger = logger;
        }

        public void Dispose()
        {
            _metrics.RecordMessageProcessingDuration(_messageType, _startTime);
        }
    }
} 