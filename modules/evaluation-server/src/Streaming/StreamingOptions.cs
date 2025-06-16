using Streaming.Connections;
using Streaming.Services;

namespace Streaming;

public class StreamingOptions
{
    public string[] SupportedVersions { get; set; } = ConnectionVersion.All;

    public string[] SupportedTypes { get; set; } = ConnectionType.All;

    public IRelayProxyService? CustomRpService { get; set; } = null;
}