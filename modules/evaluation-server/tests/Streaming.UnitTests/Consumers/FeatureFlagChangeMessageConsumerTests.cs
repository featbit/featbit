using System.Net.WebSockets;
using System.Text.Json;
using Domain.Shared;
using Microsoft.Extensions.Logging.Testing;
using Moq;
using Streaming.Connections;
using Streaming.Consumers;
using Streaming.Services;

namespace Streaming.UnitTests.Consumers;

public class FeatureFlagChangeMessageConsumerTests
{
    private readonly Mock<IConnectionManager> _connectionManager = new();
    private readonly Mock<IDataSyncService> _dataSyncService = new();
    private readonly FakeLogger<FeatureFlagChangeMessageConsumer> _logger = new();
    private readonly FeatureFlagChangeMessageConsumer _consumer;

    private static readonly Guid EnvId = Guid.Parse("226b9bf8-4af3-4ffa-9b01-162270e4cd40");

    public FeatureFlagChangeMessageConsumerTests()
    {
        _consumer = new FeatureFlagChangeMessageConsumer(_connectionManager.Object, _dataSyncService.Object, _logger);
    }

    [Fact]
    public void Topic_IsFeatureFlagChange()
    {
        Assert.Equal("featbit-feature-flag-change", _consumer.Topic);
    }

    [Fact]
    public async Task HandleAsync_NoConnectionsForEnv_DoesNothing()
    {
        _connectionManager.Setup(c => c.GetEnvConnections(EnvId)).Returns(Array.Empty<Connection>());

        var message = BuildMessage(EnvId);

        await _consumer.HandleAsync(message, CancellationToken.None);

        _dataSyncService.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task HandleAsync_OneServerConnection_SendsServerMessageToConnection()
    {
        var ws = CreateOpenWebSocketMock(out var sent);
        var connection = new Connection(ws.Object, new Secret(SecretTypes.Server, "p", EnvId, "dev"));

        _connectionManager.Setup(c => c.GetEnvConnections(EnvId)).Returns(new[] { connection });
        _dataSyncService
            .Setup(s => s.GetFlagChangePayloadAsync(connection, It.IsAny<JsonElement>()))
            .ReturnsAsync(new { dummy = 1 });

        var message = BuildMessage(EnvId);

        await _consumer.HandleAsync(message, CancellationToken.None);

        await sent.WaitAsync(TimeSpan.FromSeconds(5));
        ws.Verify(x => x.SendAsync(
            It.IsAny<ArraySegment<byte>>(),
            WebSocketMessageType.Text,
            true,
            It.IsAny<CancellationToken>()), Times.Once);
        Assert.Empty(_logger.Collector.GetSnapshot());
    }

    [Fact]
    public async Task HandleAsync_OneConnectionFails_LogsErrorAndContinuesToNextConnection()
    {
        var failingWs = CreateOpenWebSocketMock();
        var workingWs = CreateOpenWebSocketMock(out var workingSent);
        var failing = new Connection(failingWs.Object, new Secret(SecretTypes.Server, "p", EnvId, "dev"));
        var working = new Connection(workingWs.Object, new Secret(SecretTypes.Server, "p", EnvId, "dev"));

        _connectionManager.Setup(c => c.GetEnvConnections(EnvId)).Returns(new[] { failing, working });
        _dataSyncService
            .Setup(s => s.GetFlagChangePayloadAsync(failing, It.IsAny<JsonElement>()))
            .ThrowsAsync(new InvalidOperationException("boom"));
        _dataSyncService
            .Setup(s => s.GetFlagChangePayloadAsync(working, It.IsAny<JsonElement>()))
            .ReturnsAsync(new { ok = true });

        var message = BuildMessage(EnvId);

        await _consumer.HandleAsync(message, CancellationToken.None);

        await workingSent.WaitAsync(TimeSpan.FromSeconds(5));
        workingWs.Verify(x => x.SendAsync(
            It.IsAny<ArraySegment<byte>>(),
            WebSocketMessageType.Text,
            true,
            It.IsAny<CancellationToken>()), Times.Once);

        var record = Assert.Single(_logger.Collector.GetSnapshot());
        Assert.Equal(Microsoft.Extensions.Logging.LogLevel.Error, record.Level);
        Assert.Contains("feature flag change", record.Message);
        Assert.IsType<InvalidOperationException>(record.Exception);
    }

    [Fact]
    public async Task HandleAsync_StalledFirstSocket_DoesNotBlockHealthySocketOrNextMessage()
    {
        var blocked = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var entered = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var stalled = CreateOpenWebSocketMock();
        stalled.Setup(x => x.SendAsync(It.IsAny<ArraySegment<byte>>(), WebSocketMessageType.Text, true,
            It.IsAny<CancellationToken>())).Returns(() => { entered.TrySetResult(); return blocked.Task; });
        var healthy = CreateOpenWebSocketMock(out var sent);
        var first = new Connection(stalled.Object, new Secret(SecretTypes.Server, "p", EnvId, "dev"));
        var second = new Connection(healthy.Object, new Secret(SecretTypes.Server, "p", EnvId, "dev"));
        _connectionManager.Setup(x => x.GetEnvConnections(EnvId)).Returns([first, second]);
        _dataSyncService.Setup(s => s.GetFlagChangePayloadAsync(It.IsAny<Connection>(), It.IsAny<JsonElement>())).ReturnsAsync(new { updated = true });

        try
        {
            await _consumer.HandleAsync(BuildMessage(EnvId), CancellationToken.None).WaitAsync(TimeSpan.FromSeconds(5));
            await entered.Task.WaitAsync(TimeSpan.FromSeconds(5));
            await sent.WaitAsync(TimeSpan.FromSeconds(5));
            await _consumer.HandleAsync(BuildMessage(EnvId), CancellationToken.None).WaitAsync(TimeSpan.FromSeconds(5));
            Assert.False(blocked.Task.IsCompleted);
        }
        finally
        {
            blocked.TrySetResult();
            await WebSocketSender.For(stalled.Object).CompleteAsync();
            await WebSocketSender.For(healthy.Object).CompleteAsync();
        }
    }

    private static string BuildMessage(Guid envId) =>
        JsonSerializer.Serialize(new { envId, id = "flag-1" });

    private static Mock<WebSocket> CreateOpenWebSocketMock() => CreateOpenWebSocketMock(out _);

    private static Mock<WebSocket> CreateOpenWebSocketMock(out Task sent)
    {
        var completion = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        sent = completion.Task;
        var ws = new Mock<WebSocket>();
        ws.SetupGet(x => x.State).Returns(WebSocketState.Open);
        ws.Setup(x => x.SendAsync(
                It.IsAny<ArraySegment<byte>>(),
                It.IsAny<WebSocketMessageType>(),
                It.IsAny<bool>(),
                It.IsAny<CancellationToken>()))
            .Returns(() => { completion.TrySetResult(); return Task.CompletedTask; });
        return ws;
    }
}
