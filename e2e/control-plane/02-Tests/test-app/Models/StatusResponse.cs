namespace FeatBit.TestApp.Models;

public sealed class StatusResponse
{
    public string InstanceId { get; set; } = string.Empty;
    public string ConnectionState { get; set; } = "Disconnected";
    public string? ConnectedAt { get; set; }
    public string? DisconnectedAt { get; set; }
    public List<DataSyncEvent> DataSyncEventsReceived { get; set; } = [];
    public int DataSyncEventCount { get; set; }
    public Dictionary<string, FlagEvaluation> FlagEvaluations { get; set; } = new();
    public string? EvalServerEndpoint { get; set; }
}

public sealed class DataSyncEvent
{
    public string EventType { get; set; } = string.Empty;
    public string ReceivedAt { get; set; } = string.Empty;
    public int FlagCount { get; set; }
}

public sealed class FlagEvaluation
{
    public bool Value { get; set; }
    public string EvaluatedAt { get; set; } = string.Empty;
}
