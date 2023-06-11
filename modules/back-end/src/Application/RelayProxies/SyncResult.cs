namespace Application.RelayProxies;

public class SyncResult
{
    public bool Success { get; set; }

    public DateTime? SyncAt { get; set; }

    public string Reason { get; set; }

    public static SyncResult Ok(DateTime? syncAt)
    {
        return new SyncResult
        {
            Success = true,
            SyncAt = syncAt,
            Reason = string.Empty
        };
    }

    public static SyncResult Failed(string reason)
    {
        return new SyncResult
        {
            Success = false,
            SyncAt = null,
            Reason = reason
        };
    }
}