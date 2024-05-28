using Confluent.Kafka;
using Infrastructure.Kafka;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Moq;
using System;
using System.Collections;
using System.Collections.Generic;
using System.Threading.Tasks;
using Xunit;

namespace Infrastructure.UnitTests;

using SetupParameters = Tuple<Mock<IAdminClient>, Mock<IAdminClient>>;
using SetupFailingAdminClients = Action<Tuple<Mock<IAdminClient>, Mock<IAdminClient>>>;

public class KafkaReadinessCheckTests : ReadinessTest
{
    private readonly Mock<IAdminClient> _mockConsumerAdminClient;
    private readonly Mock<IAdminClient> _mockProducerAdminClient;
    private readonly Mock<KafkaConsumerAdminClientStore> _mockConsumerAdminClientStore;
    private readonly Mock<KafkaProducerAdminClientStore> _mockProducerAdminClientStore;
    private readonly KafkaReadinessCheck _kafkaReadinessCheck;

    public KafkaReadinessCheckTests() : base()
    {
        _mockConsumerAdminClient = new();
        _mockProducerAdminClient = new();

        var configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string> {
            { "Kafka:Producer:bootstrap.servers", "ProducerServer" },
            { "Kafka:Consumer:bootstrap.servers", "ConsumerServer" },
        }).Build();

        _mockConsumerAdminClientStore = new(configuration);
        _mockConsumerAdminClientStore.Setup(store => store.GetClient()).Returns(_mockConsumerAdminClient.Object);

        _mockProducerAdminClientStore = new(configuration);
        _mockProducerAdminClientStore.Setup(store => store.GetClient()).Returns(_mockProducerAdminClient.Object);

        _kafkaReadinessCheck = new(_mockConsumerAdminClientStore.Object, _mockProducerAdminClientStore.Object);
    }

    [Fact]
    public async Task ItReturnsHealthyWhenBothConsumerAndProducerAreAvailable()
    {
        var expected = HealthCheckResult.Healthy("Kafka is currently available.");
        var actual = await _kafkaReadinessCheck.CheckHealthAsync(healthCheckContext);

        Assert.Equal(expected.Description, actual.Description);
        Assert.Equal(expected.Status, actual.Status);
    }

    [Theory]
    [ClassData(typeof(KafkaDbReadinessCheckTestData))]
    public async Task ItReturnsUnhealthyWhenEitherConsumerOrProducerIsUnavailable(SetupFailingAdminClients setupAdminClients)
    {
        setupAdminClients(new(_mockConsumerAdminClient, _mockProducerAdminClient));

        var actual = await _kafkaReadinessCheck.CheckHealthAsync(healthCheckContext);
        var expected = HealthCheckResult.Unhealthy("Kafka is currently unavailable.");

        Assert.Equal(expected.Status, actual.Status);
        Assert.Equal(expected.Description, actual.Description);
        Assert.Equal(expected.Exception, actual.Exception);
    }
}

class KafkaDbReadinessCheckTestData : IEnumerable<object[]>
{
    private static readonly Exception _consumerClientException = new Exception("The consumer admin client has failed");
    private static readonly Exception _producerClientException = new Exception("The producer admin client has failed");

    private static readonly SetupFailingAdminClients _consumerAdminClientFails
        = (SetupParameters setupParameters) =>
        {
            var consumerAdminClient = setupParameters.Item2;
            MakeAdminClientMockThrow(consumerAdminClient, _consumerClientException);
        };

    private static readonly SetupFailingAdminClients _producerAdminClientFails
        = (SetupParameters setupParameters) =>
        {
            var producerAdminClient = setupParameters.Item1;
            MakeAdminClientMockThrow(producerAdminClient, _producerClientException);
        };

    private static readonly SetupFailingAdminClients _bothAdminClientsFail
        = (SetupParameters setupParameters) =>
        {
            var consumerAdminClient = setupParameters.Item2;
            var producerAdminClient = setupParameters.Item1;

            MakeAdminClientMockThrow(consumerAdminClient, _consumerClientException);
            MakeAdminClientMockThrow(producerAdminClient, _producerClientException);
        };

    private static void MakeAdminClientMockThrow(Mock<IAdminClient> mock, Exception thrownException)
    {
        mock.Setup(adminClient => adminClient.GetMetadata(It.IsAny<TimeSpan>())).Throws(thrownException);
    }

    public IEnumerator<object[]> GetEnumerator()
    {
        yield return new object[] { _consumerAdminClientFails };
        yield return new object[] { _producerAdminClientFails };
        yield return new object[] { _bothAdminClientsFail };
    }

    IEnumerator IEnumerable.GetEnumerator() => GetEnumerator();
}
