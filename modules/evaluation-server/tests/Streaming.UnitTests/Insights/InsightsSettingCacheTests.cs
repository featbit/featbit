using System.Text;
using System.Text.Json;
using Domain.Shared;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Testing;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.Time.Testing;
using Moq;
using Streaming.Insights;

namespace Streaming.UnitTests.Insights;

public class InsightsSettingCacheTests
{
    private static readonly Guid EnvId = Guid.Parse("7a0c6f4e-3a47-4c52-8f1c-5a1f9a3a2b11");

    private readonly Mock<IStore> _store = new();
    private readonly FakeTimeProvider _time = new(new DateTimeOffset(2026, 9, 23, 12, 0, 0, TimeSpan.Zero));
    private readonly FakeLogger<InsightsSettingCache> _logger = new();
    private readonly InsightsSettingCache _cache;

    public InsightsSettingCacheTests()
    {
        var options = Options.Create(new InsightsOptions { SettingCacheTtlSeconds = 300 });
        _cache = new InsightsSettingCache(_store.Object, options, _time, _logger);
    }

    private static byte[] FlagBytes(string key, bool? insightsEnabled, bool isArchived = false)
    {
        var flag = new Dictionary<string, object> { ["envId"] = EnvId, ["key"] = key, ["isArchived"] = isArchived };
        if (insightsEnabled.HasValue)
        {
            flag["insightsEnabled"] = insightsEnabled.Value;
        }

        return Encoding.UTF8.GetBytes(JsonSerializer.Serialize(flag));
    }

    private static JsonElement FlagJson(string key, bool? insightsEnabled, bool isArchived = false) =>
        JsonDocument.Parse(FlagBytes(key, insightsEnabled, isArchived)).RootElement;

    private void StoreReturns(params byte[][] flags) =>
        _store.Setup(x => x.GetFlagsAsync(EnvId, 0)).ReturnsAsync(flags);

    [Fact]
    public async Task EnsureLoadedAsync_FirstCall_HoldsOnlyDisabledKeys()
    {
        StoreReturns(FlagBytes("off", false), FlagBytes("on", true), FlagBytes("legacy", null));

        await _cache.EnsureLoadedAsync(EnvId);

        Assert.True(_cache.IsDisabled(EnvId, "off"));
        Assert.False(_cache.IsDisabled(EnvId, "on"));
        Assert.False(_cache.IsDisabled(EnvId, "legacy"));
        Assert.False(_cache.IsDisabled(EnvId, "unknown"));
    }

    [Fact]
    public async Task EnsureLoadedAsync_ArchivedDisabledFlag_IsNotHeld()
    {
        StoreReturns(FlagBytes("archived", false, isArchived: true));

        await _cache.EnsureLoadedAsync(EnvId);

        Assert.False(_cache.IsDisabled(EnvId, "archived"));
    }

    [Fact]
    public async Task EnsureLoadedAsync_ConcurrentCallers_ShareOneLoad()
    {
        var pending = new TaskCompletionSource<IEnumerable<byte[]>>();
        _store.Setup(x => x.GetFlagsAsync(EnvId, 0)).Returns(pending.Task);

        var first = _cache.EnsureLoadedAsync(EnvId).AsTask();
        var second = _cache.EnsureLoadedAsync(EnvId).AsTask();
        pending.SetResult([FlagBytes("off", false)]);
        await Task.WhenAll(first, second);

        _store.Verify(x => x.GetFlagsAsync(EnvId, 0), Times.Once);
        Assert.True(_cache.IsDisabled(EnvId, "off"));
    }

    [Fact]
    public async Task EnsureLoadedAsync_WithinTtl_DoesNotReload()
    {
        StoreReturns(FlagBytes("off", false));
        await _cache.EnsureLoadedAsync(EnvId);

        _time.Advance(TimeSpan.FromSeconds(299));
        await _cache.EnsureLoadedAsync(EnvId);

        _store.Verify(x => x.GetFlagsAsync(EnvId, 0), Times.Once);
    }

    [Fact]
    public async Task EnsureLoadedAsync_TtlElapsed_ServesCurrentSetWhileReloading()
    {
        StoreReturns(FlagBytes("off", false));
        await _cache.EnsureLoadedAsync(EnvId);
        var reloaded = new TaskCompletionSource<IEnumerable<byte[]>>();
        _store.Setup(x => x.GetFlagsAsync(EnvId, 0)).Returns(reloaded.Task);

        _time.Advance(TimeSpan.FromSeconds(300));
        await _cache.EnsureLoadedAsync(EnvId);

        Assert.True(_cache.IsDisabled(EnvId, "off"));
        reloaded.SetResult([FlagBytes("off", true)]);
        await WaitUntilAsync(() => !_cache.IsDisabled(EnvId, "off"));
    }

    [Fact]
    public async Task EnsureLoadedAsync_StoreFails_FailsOpenLogsWarningAndBacksOff()
    {
        _store.Setup(x => x.GetFlagsAsync(EnvId, 0)).ThrowsAsync(new InvalidOperationException("store down"));

        await _cache.EnsureLoadedAsync(EnvId);
        await _cache.EnsureLoadedAsync(EnvId);

        Assert.False(_cache.IsDisabled(EnvId, "off"));
        Assert.Equal(LogLevel.Warning, _logger.LatestRecord.Level);
        _store.Verify(x => x.GetFlagsAsync(EnvId, 0), Times.Once);

        StoreReturns(FlagBytes("off", false));
        _time.Advance(TimeSpan.FromSeconds(30));
        await _cache.EnsureLoadedAsync(EnvId);

        Assert.True(_cache.IsDisabled(EnvId, "off"));
    }

    [Fact]
    public async Task Apply_LoadedEnv_AddsAndRemovesKey()
    {
        StoreReturns();
        await _cache.EnsureLoadedAsync(EnvId);

        _cache.Apply(FlagJson("f", false));
        Assert.True(_cache.IsDisabled(EnvId, "f"));

        _cache.Apply(FlagJson("f", true));
        Assert.False(_cache.IsDisabled(EnvId, "f"));
    }

    [Fact]
    public async Task Apply_ArchivedFlag_RemovesKey()
    {
        StoreReturns(FlagBytes("f", false));
        await _cache.EnsureLoadedAsync(EnvId);

        _cache.Apply(FlagJson("f", false, isArchived: true));

        Assert.False(_cache.IsDisabled(EnvId, "f"));
    }

    [Fact]
    public void Apply_EnvNotLoaded_IsIgnored()
    {
        _cache.Apply(FlagJson("f", false));

        Assert.False(_cache.IsDisabled(EnvId, "f"));
    }

    private static async Task WaitUntilAsync(Func<bool> condition)
    {
        var deadline = DateTime.UtcNow.AddSeconds(5);
        while (!condition())
        {
            if (DateTime.UtcNow > deadline)
            {
                throw new TimeoutException("Condition not met within 5 seconds.");
            }

            await Task.Yield();
        }
    }
}
