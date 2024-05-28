using Microsoft.Extensions.Configuration;

namespace Infrastructure.Kafka;

public class KafkaConsumerAdminClientStore : KafkaAdminClientStore
{
    public KafkaConsumerAdminClientStore(IConfiguration configuration) : base(KafkaHost.Consumer, configuration)
    { }
}
