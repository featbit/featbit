using Domain.Core;

namespace Domain.Protocol;

public class DataSyncMessage
{
    public long? Timestamp { get; set; }

    public EndUser? User { get; set; }
}