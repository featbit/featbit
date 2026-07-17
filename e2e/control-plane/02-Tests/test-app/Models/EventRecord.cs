namespace FeatBit.TestApp.Models;

public sealed class EventRecord
{
    public string Type { get; set; } = string.Empty;
    public string Timestamp { get; set; } = string.Empty;
    public Dictionary<string, object> Details { get; set; } = new();
}

public sealed class EventsResponse
{
    public List<EventRecord> Events { get; set; } = [];
}
