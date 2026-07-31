using Api.Application.Admin;
using Domain.Messages;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Testing;
using Moq;

namespace Api.UnitTests.Application.Admin;

public class PushFullSyncHandlerTests
{
    private readonly Mock<IMessageProducer> _producer = new();
    private readonly FakeLogger<PushFullSyncHandler> _logger = new();

    private PushFullSyncHandler CreateSut()
        => new(_producer.Object, _logger);

    [Fact]
    public async Task Handle_WhenPublishSucceeds_ReturnsTrue_AndPublishesToExpectedTopic()
    {
        var sut = CreateSut();

        _producer
            .Setup(x => x.PublishAsync(
                ControlPlaneTopics.ControlPlaneCommand,
                It.IsAny<object>()))
            .Returns(Task.CompletedTask);

        var result = await sut.Handle(new PushFullSync(), CancellationToken.None);

        Assert.True(result);

        _producer.Verify(x => x.PublishAsync(
            ControlPlaneTopics.ControlPlaneCommand,
            It.IsAny<object>()), Times.Once);

        Assert.DoesNotContain(_logger.Collector.GetSnapshot(), x => x.Level == LogLevel.Error);
    }

    [Fact]
    public async Task Handle_WhenPublishThrows_LogsError_AndReturnsFalse()
    {
        var sut = CreateSut();

        var ex = new InvalidOperationException("boom");

        _producer
            .Setup(x => x.PublishAsync(
                ControlPlaneTopics.ControlPlaneCommand,
                It.IsAny<object>()))
            .ThrowsAsync(ex);

        var result = await sut.Handle(new PushFullSync(), CancellationToken.None);

        Assert.False(result);

        _producer.Verify(x => x.PublishAsync(
            ControlPlaneTopics.ControlPlaneCommand,
            It.IsAny<object>()), Times.Once);

        var record = Assert.Single(_logger.Collector.GetSnapshot(), x => x.Level == LogLevel.Error);
        Assert.Same(ex, record.Exception);
    }
}