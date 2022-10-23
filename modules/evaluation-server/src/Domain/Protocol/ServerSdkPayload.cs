using System.Text.Json.Nodes;

namespace Domain.Protocol;

public class ServerSdkPayload
{
    public string EventType { get; set; }

    public List<JsonObject> FeatureFlags { get; set; }

    public List<JsonObject> Segments { get; set; }

    public ServerSdkPayload(string eventType, List<JsonObject> featureFlags, List<JsonObject> segments)
    {
        EventType = eventType;
        FeatureFlags = featureFlags;
        Segments = segments;
    }
}