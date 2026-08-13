using System.Collections.Concurrent;
using FeatBit.TestApp.Models;

namespace FeatBit.TestApp.Services;

public sealed class EventTracker
{
    private readonly ConcurrentBag<EventRecord> _events = [];

    public void RecordEvent(string type, Dictionary<string, object>? details = null)
    {
        _events.Add(new EventRecord
        {
            Type = type,
            Timestamp = DateTime.UtcNow.ToString("o"),
            Details = details ?? new Dictionary<string, object>()
        });
    }

    public List<EventRecord> GetEvents()
    {
        return [.. _events.OrderBy(e => e.Timestamp)];
    }

    public List<DataSyncEvent> GetDataSyncEvents()
    {
        return _events
            .Where(e => e.Type == "data-sync")
            .OrderBy(e => e.Timestamp)
            .Select(e => new DataSyncEvent
            {
                EventType = e.Details.TryGetValue("eventType", out var et) ? et.ToString()! : "unknown",
                ReceivedAt = e.Timestamp,
                FlagCount = e.Details.TryGetValue("flagCount", out var fc) && fc is int count ? count : 0
            })
            .ToList();
    }

    public void Clear()
    {
        _events.Clear();
    }
}
