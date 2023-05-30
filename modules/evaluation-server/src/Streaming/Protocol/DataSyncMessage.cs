using Domain.EndUsers;

namespace Streaming.Protocol;

public class DataSyncMessage
{
    public long? Timestamp { get; set; }

    public EndUser? User { get; set; }
}