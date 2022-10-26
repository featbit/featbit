#nullable disable

using System.Text.Json.Serialization;

namespace Domain.Insights;

public class InsightMessage
{
    [JsonPropertyName("uuid")] 
    public string Uuid { get; set; }

    [JsonPropertyName("distinct_id")] 
    public string DistinctId { get; set; }

    [JsonPropertyName("env_id")] 
    public string EnvId { get; set; }

    [JsonPropertyName("event")] 
    public string Event { get; set; }

    [JsonPropertyName("properties")] 
    public string Properties { get; set; }

    [JsonPropertyName("timestamp")] 
    public string Timestamp { get; set; }
}