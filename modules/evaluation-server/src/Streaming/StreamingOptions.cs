using Streaming.Connections;
using Streaming.Services;

namespace Streaming;

public class StreamingOptions
{
    public const string Streaming = nameof(Streaming);

    public string[] SupportedVersions { get; set; } = ConnectionVersion.All;

    public string[] SupportedTypes { get; set; } = ConnectionType.All;

    public IRelayProxyService? CustomRpService { get; set; } = null;

    public bool TrackClientHostName { get; set; } = true;

    public int TokenExpirySeconds { get; set; } = 30;

    /// <summary>
    /// Maximum number of in-flight payload evaluations + sends during a
    /// <c>PushFullSyncToAllActiveSdks</c> call. The cap is shared across all envs and all
    /// connections to bound CPU / GC / network pressure during the refresh.
    /// Must be at least 1. Defaults to 50.
    /// </summary>
    public int PushFullSyncMaxConcurrency { get; set; } = 50;
}