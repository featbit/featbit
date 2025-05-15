using Streaming.Connections;

namespace Streaming;

public class StreamingOptions
{
    public string[] SupportedVersions { get; set; } = ConnectionVersion.All;

    public string[] SupportedTypes { get; set; } = ConnectionType.All;
}