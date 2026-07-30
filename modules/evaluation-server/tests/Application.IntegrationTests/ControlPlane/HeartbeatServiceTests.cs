using Api.ControlPlane;
using Domain.Messages;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Streaming.ControlPlane;

namespace Application.IntegrationTests.ControlPlane;

/// <summary>
/// Pure unit tests for the heartbeat payload construction (no infra). Exercises
/// <see cref="HeartbeatService.BuildHeartbeatAsync"/> and the DcId/Region config accessors.
/// The applied watermarks come from an <see cref="IAppliedWatermarkReader"/>; the Redis-backed
/// reader itself is covered by <see cref="RedisAppliedWatermarkReaderTests"/>.
/// </summary>
[Trait("Category", "Host")]
public class HeartbeatServiceTests
{
    private sealed class NoopMessageProducer : IMessageProducer
    {
        public Task PublishAsync<TMessage>(string topic, TMessage? message) where TMessage : class
            => Task.CompletedTask;
    }

    private sealed class StubAppliedWatermarkReader(Dictionary<Guid, long> watermarks) : IAppliedWatermarkReader
    {
        public Task<Dictionary<Guid, long>> ReadAsync(CancellationToken cancellationToken = default)
            => Task.FromResult(watermarks);
    }

    private static IConfiguration Config(params (string Key, string? Value)[] values)
        => new ConfigurationBuilder()
            .AddInMemoryCollection(values.Select(v => new KeyValuePair<string, string?>(v.Key, v.Value)))
            .Build();

    private static HeartbeatService CreateSut(IConfiguration configuration, IAppliedWatermarkReader reader)
        => new(
            new NoopMessageProducer(),
            NullLogger<HeartbeatService>.Instance,
            configuration,
            reader,
            new HeartbeatPublishStatus());

    [Fact]
    public async Task BuildHeartbeat_PopulatesDcIdAndRegion_FromConfig()
    {
        var config = Config(
            ("ControlPlane:DcId", "dc-west"),
            ("ControlPlane:Region", "us-west-2"));
        var sut = CreateSut(config, new StubAppliedWatermarkReader(new Dictionary<Guid, long>()));

        var heartbeat = await sut.BuildHeartbeatAsync();

        Assert.Equal("dc-west", heartbeat.DcId);
        Assert.Equal("us-west-2", heartbeat.Region);
    }

    [Fact]
    public async Task BuildHeartbeat_DcIdAndRegion_AreNull_WhenUnset()
    {
        var sut = CreateSut(Config(), new StubAppliedWatermarkReader(new Dictionary<Guid, long>()));

        var heartbeat = await sut.BuildHeartbeatAsync();

        Assert.Null(heartbeat.DcId);
        Assert.Null(heartbeat.Region);
    }

    [Fact]
    public async Task BuildHeartbeat_DcIdAndRegion_AreNull_WhenWhitespace()
    {
        var config = Config(
            ("ControlPlane:DcId", "   "),
            ("ControlPlane:Region", ""));
        var sut = CreateSut(config, new StubAppliedWatermarkReader(new Dictionary<Guid, long>()));

        var heartbeat = await sut.BuildHeartbeatAsync();

        Assert.Null(heartbeat.DcId);
        Assert.Null(heartbeat.Region);
    }

    [Fact]
    public async Task BuildHeartbeat_IncludesAppliedWatermarks_FromReader()
    {
        var env1 = Guid.NewGuid();
        var env2 = Guid.NewGuid();
        var reader = new StubAppliedWatermarkReader(new Dictionary<Guid, long>
        {
            [env1] = 100,
            [env2] = 300
        });

        var sut = CreateSut(Config(), reader);

        var heartbeat = await sut.BuildHeartbeatAsync();

        Assert.NotNull(heartbeat.AppliedWatermarks);
        Assert.Equal(100, heartbeat.AppliedWatermarks![env1]);
        Assert.Equal(300, heartbeat.AppliedWatermarks![env2]);
    }

    [Fact]
    public async Task BuildHeartbeat_AppliedWatermarks_IsNull_WhenNothingApplied()
    {
        var sut = CreateSut(Config(), new StubAppliedWatermarkReader(new Dictionary<Guid, long>()));

        var heartbeat = await sut.BuildHeartbeatAsync();

        Assert.Null(heartbeat.AppliedWatermarks);
    }

    [Fact]
    public async Task BuildHeartbeat_AlwaysCarries_PodIdAndTimestamp()
    {
        var sut = CreateSut(Config(), new StubAppliedWatermarkReader(new Dictionary<Guid, long>()));

        var heartbeat = await sut.BuildHeartbeatAsync();

        Assert.False(string.IsNullOrEmpty(heartbeat.PodId));
        Assert.NotEqual(default, heartbeat.Timestamp);
    }

    // #99: ControlPlane:HeartbeatIntervalSeconds must fall back to a value coherent with the
    // control plane's default ControlPlane:LeaseTtlSeconds (15s) when unset/0, not the old 60s
    // (which meant every DC lease expired between heartbeats and GatedCommit stalled).

    [Fact]
    public void ResolveHeartbeatIntervalSeconds_FallsBackToDefault_WhenUnset()
    {
        var interval = HeartbeatService.ResolveHeartbeatIntervalSeconds(Config());

        Assert.Equal(HeartbeatService.DefaultHeartbeatIntervalSeconds, interval);
        Assert.Equal(5, interval);
    }

    [Fact]
    public void ResolveHeartbeatIntervalSeconds_FallsBackToDefault_WhenZero()
    {
        var config = Config(("ControlPlane:HeartbeatIntervalSeconds", "0"));

        var interval = HeartbeatService.ResolveHeartbeatIntervalSeconds(config);

        Assert.Equal(HeartbeatService.DefaultHeartbeatIntervalSeconds, interval);
    }

    [Fact]
    public void ResolveHeartbeatIntervalSeconds_FallsBackToDefault_WhenNegative()
    {
        var config = Config(("ControlPlane:HeartbeatIntervalSeconds", "-5"));

        var interval = HeartbeatService.ResolveHeartbeatIntervalSeconds(config);

        Assert.Equal(HeartbeatService.DefaultHeartbeatIntervalSeconds, interval);
    }

    [Fact]
    public void ResolveHeartbeatIntervalSeconds_HonorsExplicitValue()
    {
        var config = Config(("ControlPlane:HeartbeatIntervalSeconds", "30"));

        var interval = HeartbeatService.ResolveHeartbeatIntervalSeconds(config);

        Assert.Equal(30, interval);
    }
}
