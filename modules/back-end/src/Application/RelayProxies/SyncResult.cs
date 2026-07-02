namespace Application.RelayProxies;

public class SyncResult
{
    public bool Success { get; set; }

    public DateTime? SyncAt { get; set; }

    public string Serves { get; set; } = string.Empty;

    public long DataVersion { get; set; }

    public string Reason { get; set; } = string.Empty;

    public static SyncResult Ok()
    {
        return new SyncResult
        {
            Success = true,
            SyncAt = DateTime.UtcNow
        };
    }

    public static SyncResult Ok(string serves, long dataVersion)
    {
        return new SyncResult
        {
            Success = true,
            SyncAt = DateTime.UtcNow,
            Serves = serves,
            DataVersion = dataVersion
        };
    }

    public static SyncResult Fail(string reason)
    {
        return new SyncResult
        {
            Success = false,
            Reason = reason
        };
    }
}