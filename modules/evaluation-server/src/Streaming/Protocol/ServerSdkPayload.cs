using System.Text.Json.Nodes;

namespace Streaming.Protocol;

public class ServerSdkPayload
{
    public string EventType { get; set; }

    public IEnumerable<JsonObject> FeatureFlags { get; set; }

    public IEnumerable<JsonObject> Segments { get; set; }

    public ServerSdkPayload(string eventType, IEnumerable<JsonObject> featureFlags, IEnumerable<JsonObject> segments)
    {
        EventType = eventType;
        FeatureFlags = featureFlags;
        Segments = segments;
    }
}