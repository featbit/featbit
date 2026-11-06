using System.Net.WebSockets;
using System.Text.Json;
using Domain.EndUsers;
using Domain.Messages;
using Domain.Shared;
using Microsoft.Extensions.Logging.Testing;
using Moq;
using Streaming.Connections;
using Streaming.Messages;
using Streaming.Protocol;
using Streaming.Services;

namespace Streaming.UnitTests.Messages;

public class DataSyncMessageHandlerTests
{
    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task HandleAsync_UserPublicationFails_StillAttachesUserAndSendsReadableFlags(bool failPublication)
    {
        var socket = new Mock<WebSocket>();
        byte[]? sent = null;
        socket.Setup(x => x.SendAsync(It.IsAny<ArraySegment<byte>>(), WebSocketMessageType.Text, true,
                It.IsAny<CancellationToken>()))
            .Callback((ArraySegment<byte> bytes, WebSocketMessageType _, bool _, CancellationToken _) => sent = bytes.ToArray())
            .Returns(Task.CompletedTask);
        var connection = new Connection(socket.Object, new Secret(SecretTypes.Client, "p", Guid.NewGuid(), "dev"));
        var context = new Mock<ConnectionContext>();
        context.SetupGet(x => x.Type).Returns(ConnectionType.Client);
        context.SetupGet(x => x.Connection).Returns(connection);
        context.SetupGet(x => x.WebSocket).Returns(socket.Object);
        var producer = new Mock<IMessageProducer>();
        producer.Setup(x => x.PublishAsync(Topics.EndUser, It.IsAny<EndUserMessage>()))
            .Returns(failPublication ? Task.FromException(new IOException("queue unavailable")) : Task.CompletedTask);
        var sync = new Mock<IDataSyncService>();
        sync.Setup(x => x.GetPayloadAsync(context.Object, It.IsAny<JsonElement>()))
            .ReturnsAsync(new { flags = new[] { "readable-flag" } });
        using var data = JsonDocument.Parse("""{"user":{"keyId":"test-user"}}""");
        var logger = new FakeLogger<DataSyncMessageHandler>();
        var handler = new DataSyncMessageHandler(producer.Object, sync.Object, logger);

        await handler.HandleAsync(new MessageContext(context.Object, data.RootElement, CancellationToken.None));

        Assert.Equal("test-user", connection.User?.KeyId);
        Assert.NotNull(sent);
        using var response = JsonDocument.Parse(sent);
        Assert.Equal(MessageTypes.DataSync, response.RootElement.GetProperty("messageType").GetString());
        Assert.Equal("readable-flag", response.RootElement.GetProperty("data").GetProperty("flags")[0].GetString());
        producer.Verify(x => x.PublishAsync(Topics.EndUser, It.Is<EndUserMessage>(message => message.EnvId == connection.EnvId)), Times.Once);
        Assert.Equal(failPublication ? 1 : 0, logger.Collector.Count);
    }
}
