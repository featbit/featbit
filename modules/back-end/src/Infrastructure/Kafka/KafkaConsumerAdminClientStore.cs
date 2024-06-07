using Confluent.Kafka;

namespace Infrastructure.Kafka;

public class KafkaConsumerAdminClientStore
{
    private readonly IAdminClient _adminClient;

    public KafkaConsumerAdminClientStore(ConsumerConfig consumerConfig)
    {
        _adminClient = new AdminClientBuilder(consumerConfig).Build();
    }

    public virtual IAdminClient GetAdminClient() => _adminClient;
}
