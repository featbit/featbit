namespace FeatBit.TestApp.Models;

public sealed class ConnectResponse
{
    public string InstanceId { get; set; } = string.Empty;
    public bool Connected { get; set; }
    public string? ConnectionTimestamp { get; set; }
}

public sealed class DisconnectResponse
{
    public string InstanceId { get; set; } = string.Empty;
    public bool Disconnected { get; set; }
    public string? DisconnectionTimestamp { get; set; }
}
