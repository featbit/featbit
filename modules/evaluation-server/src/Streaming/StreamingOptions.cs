using Streaming.Connections;

namespace Streaming;

public class StreamingOptions
{
    public const string Streaming = nameof(Streaming);

    public string[] SupportedVersions { get; set; } = ConnectionVersion.All;

    public string[] SupportedTypes { get; set; } = ConnectionType.All;

    public IRelayProxyService? CustomRpService { get; set; } = null;

    public bool TrackClientHostName { get; set; } = true;
}