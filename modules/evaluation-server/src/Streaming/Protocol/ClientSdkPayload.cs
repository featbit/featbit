using System.Text.Json;
using Domain.Evaluation;

namespace Streaming.Protocol;

public class ClientSdkPayload
{
    public string EventType { get; set; }

    public string UserKeyId { get; set; }

    public IEnumerable<ClientSdkFlag> FeatureFlags { get; set; }

    public ClientSdkPayload(
        string eventType,
        string userKeyId,
        IEnumerable<ClientSdkFlag> featureFlags)
    {
        EventType = eventType;
        UserKeyId = userKeyId;
        FeatureFlags = featureFlags;
    }
}

public class ClientSdkFlag
{
    public string Id { get; set; }

    public string Variation { get; set; }

    public string VariationType { get; set; }

    public string MatchReason { get; set; }

    public Variation[] VariationOptions { get; set; }

    public bool SendToExperiment { get; set; }

    public long Timestamp { get; set; }

    public ClientSdkFlag(JsonElement flag, UserVariation userVariation, Variation[] allVariations)
    {
        Id = flag.GetProperty("key").GetString()!;
        Variation = userVariation.Variation.Value;
        VariationType = flag.GetProperty("variationType").GetString() ?? "string";
        MatchReason = userVariation.MatchReason;
        VariationOptions = allVariations;
        SendToExperiment = userVariation.SendToExperiment;
        Timestamp = flag.GetProperty("updatedAt").GetDateTimeOffset().ToUnixTimeMilliseconds();
    }
}