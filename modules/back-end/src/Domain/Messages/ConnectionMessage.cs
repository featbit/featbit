namespace Domain.Messages;

public class ConnectionMessage
{
    public string Id { get; set; }

    public Guid EnvId { get; init; }

    public string Secret { get; init; }

    public string HeartbeatId { get; set; }
}