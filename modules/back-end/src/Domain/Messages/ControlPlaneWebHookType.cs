using System.Text.Json.Serialization;

namespace Domain.Messages;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum ControlPlaneWebHookType
{
    Segment,
    FeatureFlag
}