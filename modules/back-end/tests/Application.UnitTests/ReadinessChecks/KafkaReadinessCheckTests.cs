using Confluent.Kafka;
using Infrastructure.Kafka;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.Extensions.Configuration;
using System.Collections;

namespace Application.UnitTests.ReadinessChecks;

using SetupParameters = Tuple<Mock<IAdminClient>, Mock<IAdminClient>, Exception>;
using SetupFailingAdminClients = Action<Tuple<Mock<IAdminClient>, Mock<IAdminClient>, Exception>>;

public class KafkaReadinessCheckTests
{
    private readonly IConfiguration _configuration;
    private readonly Mock<KafkaConsumerAdminClientStore> _mockedConsumerAdminClientStore;
    private readonly Mock<KafkaProducerAdminClientStore> _mockedProducerAdminClientStore;
    private readonly Mock<IAdminClient> _mockedConsumerAdminClient;
    private readonly Mock<IAdminClient> _mockedProducerAdminClient;
    private readonly HealthCheckContext _context;

    public KafkaReadinessCheckTests()
    {
        _configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string> {
            { "Kafka:Producer:bootstrap.servers", "ProducerServer" },
            { "Kafka:Consumer:bootstrap.servers", "ConsumerServer" },
        }).Build();

        _mockedConsumerAdminClientStore = new(_configuration);
        _mockedProducerAdminClientStore = new(_configuration);

        _mockedConsumerAdminClient = new();
        _mockedProducerAdminClient = new();

        _mockedConsumerAdminClientStore.Setup(store => store.GetClient()).Returns(_mockedConsumerAdminClient.Object);
        _mockedProducerAdminClientStore.Setup(store => store.GetClient()).Returns(_mockedProducerAdminClient.Object);

        _context = new();
    }

    [Fact]
    public async Task ReturnsHealthyIfProducerAndConsumerAreAvailable()
    {
        var kafkaCheck = new KafkaReadinessCheck(
            _mockedConsumerAdminClientStore.Object,
            _mockedProducerAdminClientStore.Object
        );

        var actual = await kafkaCheck.CheckHealthAsync(_context);
        var expected = HealthCheckResult.Healthy("Kafka is currently available.");

        Assert.Equal(expected.Description, actual.Description);
        Assert.Equal(expected.Status, actual.Status);
    }

    [Theory]
    [ClassData(typeof(ErroredAdminClientTestData))]
    public async Task ReturnsUnhealthyIfConsumerOrProducerIsUnavailable(
        string errorMessage,
        SetupFailingAdminClients setupMocks
    )
    {
        var thrownException = new Exception(errorMessage);
        setupMocks(new(_mockedProducerAdminClient, _mockedConsumerAdminClient, thrownException));

        var kafkaCheck = new KafkaReadinessCheck(
            _mockedConsumerAdminClientStore.Object,
            _mockedProducerAdminClientStore.Object
        );

        var actual = await kafkaCheck.CheckHealthAsync(_context);
        var expected = HealthCheckResult.Unhealthy("Kafka is currently unavailable.", thrownException);

        Assert.Equal(expected.Status, actual.Status);
        Assert.Equal(expected.Description, actual.Description);
        Assert.Equal(expected.Exception, actual.Exception);
    }
}

class ErroredAdminClientTestData : IEnumerable<object[]>
{
    private static readonly SetupFailingAdminClients _producerAdminClientFails
        = (SetupParameters setupParameters) =>
        {
            var thrownException = setupParameters.Item3;
            var producerAdminClient = setupParameters.Item1;

            MakeAdminClientMockThrow(producerAdminClient, thrownException);
        };

    private static readonly SetupFailingAdminClients _consumerAdminClientFails
        = (SetupParameters setupParameters) =>
        {
            var thrownException = setupParameters.Item3;
            var consumerAdminClient = setupParameters.Item2;

            MakeAdminClientMockThrow(consumerAdminClient, thrownException);
        };

    private static readonly SetupFailingAdminClients _bothAdminClientsFail
        = (SetupParameters setupParameters) =>
        {
            var thrownException = setupParameters.Item3;
            var consumerAdminClient = setupParameters.Item2;
            var producerAdminClient = setupParameters.Item1;

            MakeAdminClientMockThrow(producerAdminClient, thrownException);
            MakeAdminClientMockThrow(consumerAdminClient, thrownException);
        };

    private static void MakeAdminClientMockThrow(Mock<IAdminClient> mock, Exception thrownException)
    {
        mock.Setup(adminClient => adminClient.GetMetadata(It.IsAny<TimeSpan>())).Throws(thrownException);
    }

    public IEnumerator<object[]> GetEnumerator()
    {
        yield return new object[]
        {
            "Producer unavailable",
            _producerAdminClientFails
        };

        yield return new object[]
        {
            "Consumer unavailable",
            _consumerAdminClientFails
        };

        yield return new object[]
        {
            "Producer and consumer unavailable",
            _bothAdminClientsFail
        };
    }

    IEnumerator IEnumerable.GetEnumerator() => GetEnumerator();
}
