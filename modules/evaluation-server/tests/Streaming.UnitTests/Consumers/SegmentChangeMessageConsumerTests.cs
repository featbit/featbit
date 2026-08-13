using System.Net.WebSockets;
using System.Text.Json;
using Domain.Shared;
using Microsoft.Extensions.Logging.Testing;
using Moq;
using Streaming.Connections;
using Streaming.Consumers;
using Streaming.Services;

namespace Streaming.UnitTests.Consumers;

public class SegmentChangeMessageConsumerTests
{
    private readonly Mock<IConnectionManager> _connectionManager = new();
    private readonly Mock<IDataSyncService> _dataSyncService = new();
    private readonly FakeLogger<SegmentChangeMessageConsumer> _logger = new();
    private readonly SegmentChangeMessageConsumer _consumer;

    private static readonly Guid EnvId = Guid.Parse("226b9bf8-4af3-4ffa-9b01-162270e4cd40");

    public SegmentChangeMessageConsumerTests()
    {
        _consumer = new SegmentChangeMessageConsumer(_connectionManager.Object, _dataSyncService.Object, _logger);
    }

    [Fact]
    public void Topic_IsSegmentChange()
    {
        Assert.Equal("featbit-segment-change", _consumer.Topic);
    }

    [Fact]
    public async Task HandleAsync_MissingSegmentProperty_ThrowsInvalidDataException()
    {
        const string message = """{"affectedFlagIds":["a"]}""";

        await Assert.ThrowsAsync<InvalidDataException>(
            () => _consumer.HandleAsync(message, CancellationToken.None));
    }

    [Fact]
    public async Task HandleAsync_MissingAffectedFlagIdsProperty_ThrowsInvalidDataException()
    {
        var message = JsonSerializer.Serialize(new { segment = new { envId = EnvId } });

        await Assert.ThrowsAsync<InvalidDataException>(
            () => _consumer.HandleAsync(message, CancellationToken.None));
    }

    [Fact]
    public async Task HandleAsync_ClientConnectionWithNoAffectedFlagIds_SkipsConnectionAndDoesNotSend()
    {
        var ws = CreateOpenWebSocketMock();
        var connection = new Connection(ws.Object, new Secret(SecretTypes.Client, "p", EnvId, "dev"));

        _connectionManager.Setup(c => c.GetEnvConnections(EnvId)).Returns(new[] { connection });

        var message = BuildMessage(EnvId, affectedFlagIds: Array.Empty<string>());

        await _consumer.HandleAsync(message, CancellationToken.None);

        ws.Verify(x => x.SendAsync(
            It.IsAny<ArraySegment<byte>>(),
            It.IsAny<WebSocketMessageType>(),
            It.IsAny<bool>(),
            It.IsAny<CancellationToken>()), Times.Never);
        _dataSyncService.Verify(s => s.GetSegmentChangePayloadAsync(
            It.IsAny<Connection>(), It.IsAny<JsonElement>(), It.IsAny<string[]>()), Times.Never);
    }

    [Fact]
    public async Task HandleAsync_ServerConnection_SendsServerMessageEvenWhenAffectedFlagIdsEmpty()
    {
        var ws = CreateOpenWebSocketMock();
        var connection = new Connection(ws.Object, new Secret(SecretTypes.Server, "p", EnvId, "dev"));

        _connectionManager.Setup(c => c.GetEnvConnections(EnvId)).Returns(new[] { connection });
        _dataSyncService
            .Setup(s => s.GetSegmentChangePayloadAsync(connection, It.IsAny<JsonElement>(), It.IsAny<string[]>()))
            .ReturnsAsync(new { dummy = 1 });

        var message = BuildMessage(EnvId, affectedFlagIds: Array.Empty<string>());

        await _consumer.HandleAsync(message, CancellationToken.None);

        ws.Verify(x => x.SendAsync(
            It.IsAny<ArraySegment<byte>>(),
            WebSocketMessageType.Text,
            true,
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task HandleAsync_ClientConnectionWithAffectedFlagIds_SendsServerMessage()
    {
        var ws = CreateOpenWebSocketMock();
        var connection = new Connection(ws.Object, new Secret(SecretTypes.Client, "p", EnvId, "dev"));

        _connectionManager.Setup(c => c.GetEnvConnections(EnvId)).Returns(new[] { connection });
        _dataSyncService
            .Setup(s => s.GetSegmentChangePayloadAsync(connection, It.IsAny<JsonElement>(),
                It.Is<string[]>(ids => ids.Length == 1 && ids[0] == "flag-1")))
            .ReturnsAsync(new { ok = true });

        var message = BuildMessage(EnvId, affectedFlagIds: new[] { "flag-1" });

        await _consumer.HandleAsync(message, CancellationToken.None);

        ws.Verify(x => x.SendAsync(
            It.IsAny<ArraySegment<byte>>(),
            WebSocketMessageType.Text,
            true,
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task HandleAsync_OneConnectionFails_LogsErrorAndContinuesToNextConnection()
    {
        var failingWs = CreateOpenWebSocketMock();
        var workingWs = CreateOpenWebSocketMock();
        var failing = new Connection(failingWs.Object, new Secret(SecretTypes.Server, "p", EnvId, "dev"));
        var working = new Connection(workingWs.Object, new Secret(SecretTypes.Server, "p", EnvId, "dev"));

        _connectionManager.Setup(c => c.GetEnvConnections(EnvId)).Returns(new[] { failing, working });
        _dataSyncService
            .Setup(s => s.GetSegmentChangePayloadAsync(failing, It.IsAny<JsonElement>(), It.IsAny<string[]>()))
            .ThrowsAsync(new InvalidOperationException("boom"));
        _dataSyncService
            .Setup(s => s.GetSegmentChangePayloadAsync(working, It.IsAny<JsonElement>(), It.IsAny<string[]>()))
            .ReturnsAsync(new { ok = true });

        var message = BuildMessage(EnvId, affectedFlagIds: new[] { "flag-1" });

        await _consumer.HandleAsync(message, CancellationToken.None);

        workingWs.Verify(x => x.SendAsync(
            It.IsAny<ArraySegment<byte>>(),
            WebSocketMessageType.Text,
            true,
            It.IsAny<CancellationToken>()), Times.Once);

        var record = Assert.Single(_logger.Collector.GetSnapshot());
        Assert.Equal(Microsoft.Extensions.Logging.LogLevel.Error, record.Level);
        Assert.Contains("segment change", record.Message);
        Assert.IsType<InvalidOperationException>(record.Exception);
    }

    private static string BuildMessage(Guid envId, string[] affectedFlagIds) =>
        JsonSerializer.Serialize(new
        {
            segment = new { envId, id = "seg-1" },
            affectedFlagIds
        });

    private static Mock<WebSocket> CreateOpenWebSocketMock()
    {
        var ws = new Mock<WebSocket>();
        ws.SetupGet(x => x.State).Returns(WebSocketState.Open);
        ws.Setup(x => x.SendAsync(
                It.IsAny<ArraySegment<byte>>(),
                It.IsAny<WebSocketMessageType>(),
                It.IsAny<bool>(),
                It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);
        return ws;
    }
}
