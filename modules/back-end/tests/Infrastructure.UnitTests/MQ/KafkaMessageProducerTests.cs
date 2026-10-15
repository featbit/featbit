using Confluent.Kafka;
using Infrastructure.MQ.Kafka;
using Microsoft.Extensions.Logging.Testing;
using Moq;

namespace Infrastructure.UnitTests.MQ;

public class KafkaMessageProducerTests
{
    [Fact]
    public async Task PublishAsync_WaitsForBrokerDeliveryBeforeReturning()
    {
        var accepted = new TaskCompletionSource<DeliveryResult<Null,string>>(TaskCreationOptions.RunContinuationsAsynchronously);
        var broker = new Mock<IProducer<Null,string>>();
        broker.Setup(x => x.ProduceAsync("changes", It.IsAny<Message<Null,string>>(), It.IsAny<CancellationToken>()))
            .Returns(accepted.Task);
        var producer = new KafkaMessageProducer(broker.Object, new FakeLogger<KafkaMessageProducer>());
        var publishing = producer.PublishAsync("changes", new { version = 42 });
        Assert.False(publishing.IsCompleted);
        accepted.SetResult(new DeliveryResult<Null,string> { Status = PersistenceStatus.Persisted });
        await publishing;
        broker.Verify(x => x.ProduceAsync("changes", It.IsAny<Message<Null,string>>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task PublishAsync_FailedDelivery_IsNotAcknowledgedAsSuccess()
    {
        var broker = new Mock<IProducer<Null,string>>();
        broker.Setup(x => x.ProduceAsync(It.IsAny<string>(), It.IsAny<Message<Null,string>>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new IOException("broker unavailable"));
        var producer = new KafkaMessageProducer(broker.Object, new FakeLogger<KafkaMessageProducer>());
        await Assert.ThrowsAsync<IOException>(() => producer.PublishAsync("changes", new { version = 42 }));
    }
}
