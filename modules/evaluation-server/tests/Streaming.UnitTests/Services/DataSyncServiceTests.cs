using System.Text.Json;
using Domain.Evaluation;
using Domain.Shared;
using Moq;
using Streaming.Connections;
using Streaming.Protocol;
using Streaming.Services;

namespace Streaming.UnitTests.Services;

public class DataSyncServiceTests
{
    private readonly Mock<IStore> _store = new();
    private readonly Mock<IEvaluator> _evaluator = new();
    private readonly Mock<IRelayProxyService> _rpService = new();
    private readonly DataSyncService _service;

    private static readonly Guid EnvId = Guid.Parse("226b9bf8-4af3-4ffa-9b01-162270e4cd40");

    public DataSyncServiceTests()
    {
        _service = new DataSyncService(_store.Object, _evaluator.Object, _rpService.Object);
    }

    [Fact]
    public async Task GetFlagChangePayloadAsync_ServerConnection_ReturnsServerSdkPayloadWrappingFlag()
    {
        var connection = NewConnection(SecretTypes.Server);
        var flag = ParseJson("""{"id":"flag-1","key":"k","envId":"00000000-0000-0000-0000-000000000001"}""");

        var payload = await _service.GetFlagChangePayloadAsync(connection, flag);

        var sdk = Assert.IsType<ServerSdkPayload>(payload);
        Assert.Equal(DataSyncEventTypes.Patch, sdk.EventType);
        var single = Assert.Single(sdk.FeatureFlags);
        Assert.Equal("flag-1", single["id"]!.ToString());
        Assert.Empty(sdk.Segments);
    }

    [Fact]
    public async Task GetFlagChangePayloadAsync_ClientConnectionWithoutUser_ThrowsArgumentException()
    {
        var connection = NewConnection(SecretTypes.Client);
        var flag = ParseJson("""{"id":"flag-1"}""");

        await Assert.ThrowsAsync<ArgumentException>(
            () => _service.GetFlagChangePayloadAsync(connection, flag));
    }

    [Fact]
    public async Task GetFlagChangePayloadAsync_UnsupportedConnectionType_ThrowsArgumentOutOfRange()
    {
        var connection = NewConnection(ConnectionType.RelayProxy);
        var flag = ParseJson("""{"id":"flag-1"}""");

        await Assert.ThrowsAsync<ArgumentOutOfRangeException>(
            () => _service.GetFlagChangePayloadAsync(connection, flag));
    }

    [Fact]
    public async Task GetSegmentChangePayloadAsync_ServerConnection_ReturnsServerSdkPayloadWrappingSegment()
    {
        var connection = NewConnection(SecretTypes.Server);
        var segment = ParseJson("""{"id":"seg-1","key":"all"}""");

        var payload = await _service.GetSegmentChangePayloadAsync(connection, segment, ["unused"]);

        var sdk = Assert.IsType<ServerSdkPayload>(payload);
        Assert.Equal(DataSyncEventTypes.Patch, sdk.EventType);
        Assert.Empty(sdk.FeatureFlags);
        var single = Assert.Single(sdk.Segments);
        Assert.Equal("seg-1", single["id"]!.ToString());
    }

    [Fact]
    public async Task GetSegmentChangePayloadAsync_ClientConnectionWithoutUser_ThrowsArgumentException()
    {
        var connection = NewConnection(SecretTypes.Client);
        var segment = ParseJson("""{"id":"seg-1"}""");

        await Assert.ThrowsAsync<ArgumentException>(
            () => _service.GetSegmentChangePayloadAsync(connection, segment, ["a"]));
    }

    [Fact]
    public async Task GetSegmentChangePayloadAsync_UnsupportedConnectionType_ThrowsArgumentOutOfRange()
    {
        var connection = NewConnection(ConnectionType.RelayProxy);
        var segment = ParseJson("""{"id":"seg-1"}""");

        await Assert.ThrowsAsync<ArgumentOutOfRangeException>(
            () => _service.GetSegmentChangePayloadAsync(connection, segment, []));
    }

    [Fact]
    public async Task GetServerSdkPayloadAsync_FullSyncTimestamp_RequestsFullDataAndMarksEventAsFull()
    {
        var flagBytes = "{\"id\":\"f1\"}"u8.ToArray();
        var segmentBytes = "{\"id\":\"s1\"}"u8.ToArray();
        _store.Setup(s => s.GetFlagsAsync(EnvId, 0L)).ReturnsAsync(new[] { flagBytes });
        _store.Setup(s => s.GetSegmentsAsync(EnvId, 0L)).ReturnsAsync(new[] { segmentBytes });

        var payload = await _service.GetServerSdkPayloadAsync(EnvId, timestamp: 0);

        Assert.Equal(DataSyncEventTypes.Full, payload.EventType);
        Assert.Single(payload.FeatureFlags);
        Assert.Single(payload.Segments);
    }

    [Fact]
    public async Task GetServerSdkPayloadAsync_NonZeroTimestamp_MarksEventAsPatch()
    {
        _store.Setup(s => s.GetFlagsAsync(EnvId, It.IsAny<long>())).ReturnsAsync(Array.Empty<byte[]>());
        _store.Setup(s => s.GetSegmentsAsync(EnvId, It.IsAny<long>())).ReturnsAsync(Array.Empty<byte[]>());

        var payload = await _service.GetServerSdkPayloadAsync(EnvId, timestamp: 100);

        Assert.Equal(DataSyncEventTypes.Patch, payload.EventType);
        Assert.Empty(payload.FeatureFlags);
        Assert.Empty(payload.Segments);
    }

    private static Connection NewConnection(string type) =>
        new(Mock.Of<System.Net.WebSockets.WebSocket>(), new Secret(type, "p", EnvId, "dev"));

    private static JsonElement ParseJson(string json) =>
        JsonDocument.Parse(json).RootElement.Clone();
}
