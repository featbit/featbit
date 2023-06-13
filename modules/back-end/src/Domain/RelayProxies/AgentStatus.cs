namespace Domain.RelayProxies;

public class AgentStatus
{
    public string Type { get; set; }

    public DateTime? LastSyncAt { get; set; }

    public static AgentStatus Unreachable()
    {
        return new AgentStatus
        {
            Type = "unreachable",
            LastSyncAt = null
        };
    }

    public static AgentStatus Unauthorized()
    {
        return new AgentStatus
        {
            Type = "unauthorized",
            LastSyncAt = null
        };
    }
}