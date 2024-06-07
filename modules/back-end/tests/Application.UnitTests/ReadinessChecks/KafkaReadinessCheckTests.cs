using Confluent.Kafka;
using Infrastructure.Kafka;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace Application.UnitTests.ReadinessChecks;

public class KafkaReadinessCheckTests
{
    private readonly Mock<KafkaConsumerAdminClientStore> _mockedConsumerAdminClientStore;
    private readonly Mock<IAdminClient> _mockedConsumerAdminClient;
    private readonly HealthCheckContext _context;

    public KafkaReadinessCheckTests()
    {
        _mockedConsumerAdminClientStore = new(new ConsumerConfig());
        _mockedConsumerAdminClient = new();
        _context = new();

        _mockedConsumerAdminClientStore.Setup(store => store.GetAdminClient()).Returns(_mockedConsumerAdminClient.Object);
    }

    [Fact]
    public async Task ReturnsHealthyIfConsumerIsAvailable()
    {
        var kafkaCheck = new KafkaReadinessCheck(_mockedConsumerAdminClientStore.Object);

        var actual = await kafkaCheck.CheckHealthAsync(_context);
        var expected = HealthCheckResult.Healthy("Kafka is currently available.");

        Assert.Equal(expected.Description, actual.Description);
        Assert.Equal(expected.Status, actual.Status);
    }

    [Fact]
    public async Task ReturnsUnhealthyIfConsumerIsUnavailable()
    {
        var thrownException = new Exception("Testing Exception");
        _mockedConsumerAdminClient.Setup(client => client.GetMetadata(It.IsAny<TimeSpan>())).Throws(thrownException);

        var kafkaCheck = new KafkaReadinessCheck(_mockedConsumerAdminClientStore.Object);

        var actual = await kafkaCheck.CheckHealthAsync(_context);
        var expected = HealthCheckResult.Unhealthy("Kafka is currently unavailable.", thrownException);

        Assert.Equal(expected.Status, actual.Status);
        Assert.Equal(expected.Description, actual.Description);
        Assert.Equal(expected.Exception, actual.Exception);
    }

    [Fact]
    public async Task ThrowsIfConsumerTimesOut()
    {
        var cancelledToken = new CancellationToken(canceled: true);
        var kafkaCheck = new KafkaReadinessCheck(_mockedConsumerAdminClientStore.Object);

        await Assert.ThrowsAsync<TaskCanceledException>(() => kafkaCheck.CheckHealthAsync(_context, cancelledToken));
    }
}
