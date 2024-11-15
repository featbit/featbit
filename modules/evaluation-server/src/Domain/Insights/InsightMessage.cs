#nullable disable

using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace Domain.Insights;

public class InsightMessage
{
    [JsonPropertyName("uuid")]
    public string Uuid { get; set; }

    [JsonPropertyName("distinct_id")]
    [RegularExpression("^([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})(?:-(\\w[\\w-]*))?$|^(\\w[\\w-]*)$")]
    public string DistinctId { get; set; }

    [JsonPropertyName("env_id")]
    [RegularExpression("^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$")]
    public string EnvId { get; set; }

    [JsonPropertyName("event")]
    public string Event { get; set; }

    [JsonPropertyName("properties")]
    public string Properties { get; set; }

    [JsonPropertyName("timestamp")]
    public long Timestamp { get; set; }
}