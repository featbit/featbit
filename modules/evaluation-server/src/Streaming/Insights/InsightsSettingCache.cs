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

    private readonly ConcurrentDictionary<Guid, EnvState> _states = new();
    private readonly ConcurrentDictionary<Guid, Lazy<Task>> _loads = new();
    private readonly ConcurrentDictionary<Guid, DateTimeOffset> _failedAt = new();

    private TimeSpan Ttl => TimeSpan.FromSeconds(Math.Max(1, options.Value.SettingCacheTtlSeconds));

    public ValueTask EnsureLoadedAsync(Guid envId)
    {
        var now = timeProvider.GetUtcNow();

        if (_states.TryGetValue(envId, out var state))
        {
            if (now - state.LoadedAt >= Ttl)
            {
                // serve the current set while the refresh runs
                _ = LoadOnceAsync(envId);
            }

            return ValueTask.CompletedTask;
        }

        if (_failedAt.TryGetValue(envId, out var failedAt) && now - failedAt < FailureBackoff)
        {
            return ValueTask.CompletedTask;
        }

        return new ValueTask(LoadOnceAsync(envId));
    }

    public bool IsDisabled(Guid envId, string flagKey) =>
        _states.TryGetValue(envId, out var state) && state.Disabled.Contains(flagKey);

    public void Apply(JsonElement flag)
    {
        if (!flag.TryGetProperty("envId", out var envIdProp) || !envIdProp.TryGetGuid(out var envId) ||
            !flag.TryGetProperty("key", out var keyProp) || keyProp.GetString() is not { } key)
        {
            return;
        }

        var disabled = IsInsightsDisabled(flag);
        while (_states.TryGetValue(envId, out var state))
        {
            if (state.Disabled.Contains(key) == disabled)
            {
                return;
            }

            var keys = disabled
                ? state.Disabled.Append(key)
                : state.Disabled.Where(x => x != key);
            var updated = state with { Disabled = keys.ToFrozenSet(StringComparer.Ordinal) };
            if (_states.TryUpdate(envId, updated, state))
            {
                return;
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
        try
        {
            var flags = await store.GetFlagsAsync(envId, 0);

            var disabled = new List<string>();
            foreach (var bytes in flags)
            {
                using var document = JsonDocument.Parse(bytes);
                var flag = document.RootElement;
                if (IsInsightsDisabled(flag) && flag.TryGetProperty("key", out var key) && key.GetString() is { } k)
                {
                    disabled.Add(k);
                }
            }

            _states[envId] = new EnvState(disabled.ToFrozenSet(StringComparer.Ordinal), timeProvider.GetUtcNow());
            _failedAt.TryRemove(envId, out _);
        }
        catch (Exception ex)
        {
            // fail open: until a load succeeds, insights are recorded for every flag in this environment
            _failedAt[envId] = timeProvider.GetUtcNow();
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

    // a flag without the field (stored before the setting existed) collects insights; archived flags are ignored
    private static bool IsInsightsDisabled(JsonElement flag) =>
        flag.TryGetProperty("insightsEnabled", out var enabled) &&
        enabled.ValueKind == JsonValueKind.False &&
        !(flag.TryGetProperty("isArchived", out var archived) && archived.ValueKind == JsonValueKind.True);
}
