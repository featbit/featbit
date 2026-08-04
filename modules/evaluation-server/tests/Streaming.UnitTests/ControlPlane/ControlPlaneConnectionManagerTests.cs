using Domain.ControlPlane;
using Domain.Messages;
using Microsoft.Extensions.Logging.Testing;
using Moq;
using Streaming.ControlPlane;
using Streaming.UnitTests.Builders;

namespace Streaming.UnitTests.ControlPlane;

public class ControlPlaneConnectionManagerTests
{
    [Fact]
    public async Task AddRemove_ClientConnection_PublishesLifecycleMessages()
    {
        var logger = new FakeLogger<ControlPlaneConnectionManager>();
        var producer = new Mock<IMessageProducer>();
        var manager = new ControlPlaneConnectionManager(logger, producer.Object);
        var context = new ConnectionContextBuilder().Build();

        await manager.Add(context);
        await manager.Remove(context);

        producer.Verify(x => x.PublishAsync(
            Topics.ConnectionMade,
            It.Is<ConnectionMessage>(message =>
                message.Id == context.Connection.Id &&
                message.Type == ConnectionMessageType.ConnectionMade)), Times.Once);
        producer.Verify(x => x.PublishAsync(
            Topics.ConnectionClosed,
            It.Is<ConnectionMessage>(message =>
                message.Id == context.Connection.Id &&
                message.Type == ConnectionMessageType.ConnectionClosed)), Times.Once);
    }

    [Fact]
    public async Task Add_ClientConnectionAlreadyTracked_DoesNotPublishAgain()
    {
        var logger = new FakeLogger<ControlPlaneConnectionManager>();
        var producer = new Mock<IMessageProducer>();
        var manager = new ControlPlaneConnectionManager(logger, producer.Object);
        var context = new ConnectionContextBuilder().Build();

        await manager.Add(context);
        await manager.Add(context);

        producer.Verify(x => x.PublishAsync(Topics.ConnectionMade, It.IsAny<ConnectionMessage>()), Times.Once);
    }

    [Fact]
    public async Task Remove_ClientConnectionNotTracked_DoesNotPublishAgain()
    {
        var logger = new FakeLogger<ControlPlaneConnectionManager>();
        var producer = new Mock<IMessageProducer>();
        var manager = new ControlPlaneConnectionManager(logger, producer.Object);
        var context = new ConnectionContextBuilder().Build();

        await manager.Add(context);
        await manager.Remove(context);
        await manager.Remove(context);

        producer.Verify(x => x.PublishAsync(Topics.ConnectionClosed, It.IsAny<ConnectionMessage>()), Times.Once);
    }
}
