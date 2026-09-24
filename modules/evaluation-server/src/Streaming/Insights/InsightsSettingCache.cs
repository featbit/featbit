using System.Collections.Concurrent;
using System.Collections.Frozen;
using System.Text.Json;
using Domain.Shared;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Streaming.Insights;

/// <summary>
/// Per-environment set of flag keys whose insights are disabled, used on the insight ingestion path so the
/// drop decision never waits on the store once an environment is loaded.
/// </summary>
public interface IInsightsSettingCache
{
    /// <summary>
    /// Loads the environment on first use and refreshes it in the background after the TTL. Never throws:
    /// a failed load leaves the environment unknown, which reads as "insights enabled" for every flag.
    /// </summary>
    ValueTask EnsureLoadedAsync(Guid envId);

    bool IsDisabled(Guid envId, string flagKey);

    /// <summary>
    /// Applies a flag change message (the flag's JSON) to an environment that is already loaded.
    /// </summary>
    void Apply(JsonElement flag);
}

public sealed class InsightsSettingCache(
    IStore store,
    IOptions<InsightsOptions> options,
    TimeProvider timeProvider,
    ILogger<InsightsSettingCache> logger) : IInsightsSettingCache
{
    private static readonly TimeSpan FailureBackoff = TimeSpan.FromSeconds(30);

    private sealed record EnvState(FrozenSet<string> Disabled, DateTimeOffset LoadedAt);

    private sealed class EnvEntry
    {
        public readonly object Lock = new();

        // read without the lock on the hot path; always replaced, never mutated
        public volatile EnvState? State;

        public DateTimeOffset? FailedAt;

        // flag changes received while a load is reading the store; replayed on top of its snapshot
        public Dictionary<string, bool>? ChangesDuringLoad;
    }

    private readonly ConcurrentDictionary<Guid, EnvEntry> _entries = new();
    private readonly ConcurrentDictionary<Guid, Lazy<Task>> _loads = new();

    private TimeSpan Ttl => TimeSpan.FromSeconds(Math.Max(1, options.Value.SettingCacheTtlSeconds));

    public ValueTask EnsureLoadedAsync(Guid envId)
    {
        var now = timeProvider.GetUtcNow();
        var entry = _entries.GetOrAdd(envId, _ => new EnvEntry());

        // after a failed load, wait out the backoff before hitting the store again, whether or not a set is loaded
        bool backingOff;
        lock (entry.Lock)
        {
            backingOff = entry.FailedAt is { } failedAt && now - failedAt < FailureBackoff;
        }

        if (entry.State is { } state)
        {
            if (now - state.LoadedAt >= Ttl && !backingOff)
            {
                // serve the current set while the refresh runs
                _ = LoadOnceAsync(envId);
            }

            return ValueTask.CompletedTask;
        }

        return backingOff ? ValueTask.CompletedTask : new ValueTask(LoadOnceAsync(envId));
    }

    public bool IsDisabled(Guid envId, string flagKey) =>
        _entries.TryGetValue(envId, out var entry) &&
        entry.State is { } state &&
        state.Disabled.Contains(flagKey);

    public void Apply(JsonElement flag)
    {
        if (!flag.TryGetProperty("envId", out var envIdProp) || !envIdProp.TryGetGuid(out var envId) ||
            !flag.TryGetProperty("key", out var keyProp) || keyProp.GetString() is not { } key ||
            !_entries.TryGetValue(envId, out var entry))
        {
            // environment never requested: its first load reads the store after this change
            return;
        }

        var disabled = IsInsightsDisabled(flag);
        lock (entry.Lock)
        {
            if (entry.ChangesDuringLoad is { } changes)
            {
                changes[key] = disabled;
            }

            if (entry.State is { } state && state.Disabled.Contains(key) != disabled)
            {
                entry.State = state with { Disabled = WithKey(state.Disabled, key, disabled) };
            }
        }
    }

    private Task LoadOnceAsync(Guid envId)
    {
        var load = _loads.GetOrAdd(envId, id => new Lazy<Task>(() => LoadAsync(id)));
        return load.Value;
    }

    private async Task LoadAsync(Guid envId)
    {
        var entry = _entries.GetOrAdd(envId, _ => new EnvEntry());
        lock (entry.Lock)
        {
            entry.ChangesDuringLoad = new Dictionary<string, bool>(StringComparer.Ordinal);
        }

        try
        {
            var flags = await store.GetFlagsAsync(envId, 0);

            var disabled = new HashSet<string>(StringComparer.Ordinal);
            foreach (var bytes in flags)
            {
                using var document = JsonDocument.Parse(bytes);
                var flag = document.RootElement;
                if (IsInsightsDisabled(flag) && flag.TryGetProperty("key", out var key) && key.GetString() is { } k)
                {
                    disabled.Add(k);
                }
            }

            lock (entry.Lock)
            {
                // changes received during the read may be newer than the snapshot: they win
                foreach (var (key, isDisabled) in entry.ChangesDuringLoad!)
                {
                    if (isDisabled)
                    {
                        disabled.Add(key);
                    }
                    else
                    {
                        disabled.Remove(key);
                    }
                }

                entry.State = new EnvState(disabled.ToFrozenSet(StringComparer.Ordinal), timeProvider.GetUtcNow());
                entry.FailedAt = null;
                entry.ChangesDuringLoad = null;
            }
        }
        catch (Exception ex)
        {
            // fail open: until a load succeeds, insights are recorded for every flag in this environment
            lock (entry.Lock)
            {
                entry.FailedAt = timeProvider.GetUtcNow();
                entry.ChangesDuringLoad = null;
            }

            logger.LogWarning(
                ex,
                "Failed to load insight settings for env {EnvId}; recording insights for all flags until the next retry.",
                envId
            );
        }
        finally
        {
            _loads.TryRemove(envId, out _);
        }
    }

    private static FrozenSet<string> WithKey(FrozenSet<string> keys, string key, bool present) =>
        (present ? keys.Append(key) : keys.Where(x => x != key)).ToFrozenSet(StringComparer.Ordinal);

    // a flag without the field (stored before the setting existed) collects insights; archived flags are ignored
    private static bool IsInsightsDisabled(JsonElement flag) =>
        flag.TryGetProperty("insightsEnabled", out var enabled) &&
        enabled.ValueKind == JsonValueKind.False &&
        !(flag.TryGetProperty("isArchived", out var archived) && archived.ValueKind == JsonValueKind.True);
}
