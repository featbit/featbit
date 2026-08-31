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

    public bool IsEmpty()
    {
        return EventType == DataSyncEventTypes.Patch && !FeatureFlags.Any();
    }
}

public class ClientSdkFlag
{
    public string Id { get; set; }

    public string? Variation { get; set; }

    public string VariationType { get; set; }

    public string? VariationId { get; set; }

    public string MatchReason { get; set; }

    public Variation[] VariationOptions { get; set; }

    public bool SendToExperiment { get; set; }

    public long Timestamp { get; set; }

    public ClientSdkFlag(JsonElement flag, UserVariation userVariation, Variation[] allVariations)
    {
        var reader = EntityJsonReader.FeatureFlag;

        Id = reader.GetRequiredString(flag, "key");
        VariationType = reader.GetNullableString(flag, "variationType") ?? "string";
        VariationOptions = allVariations;
        Timestamp = reader.GetRequiredDateTimeOffset(flag, "updatedAt").ToUnixTimeMilliseconds();

        Variation = userVariation.Variation?.Value;
        VariationId = userVariation.Variation?.Id;
        MatchReason = userVariation.MatchReason;
        SendToExperiment = userVariation.SendToExperiment;
    }
}
