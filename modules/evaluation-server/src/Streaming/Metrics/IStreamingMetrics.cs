namespace Streaming.Metrics;

public interface IStreamingMetrics
{
    void ConnectionEstablished(string type);
    void ConnectionClosed(long durationMs);
    void ConnectionRejected(string reason);
    void ConnectionError(string errorType);
    IDisposable TrackMessageProcessing(string messageType, int messageSizeBytes);
} 