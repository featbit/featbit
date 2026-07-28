namespace Domain.ControlPlane;

public enum ConnectionMessageType
{
    ConnectionMade = 1,
    ConnectionClosed = 2
}

public class ConnectionMessage
{
    public ConnectionMessageType Type { get; init; }

    public Guid EnvId { get; init; }

    // TODO: secret is actually project key, we should rename it to avoid confusion
    public string Secret { get; init; }

    public string Id { get; init; }

    public string HeartbeatId { get; init; } = InfrastructureInfo.Id.ToString();

    public ConnectionMessage(string connectionId, Guid envId, string projectKey, ConnectionMessageType type)
    {
        Id = connectionId;
        EnvId = envId;
        Secret = projectKey;
        Type = type;
    }
}