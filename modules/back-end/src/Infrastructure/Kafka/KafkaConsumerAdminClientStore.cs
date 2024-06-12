using Confluent.Kafka;

namespace Infrastructure.Kafka;

public class KafkaConsumerAdminClientStore
{
    private readonly IAdminClient _adminClient;

    public KafkaConsumerAdminClientStore(ConsumerConfig consumerConfig)
    {
        _adminClient = new AdminClientBuilder(new AdminClientConfig
        {
            BootstrapServers = consumerConfig.BootstrapServers
        }).Build();
    }

    public virtual IAdminClient GetAdminClient() => _adminClient;
}