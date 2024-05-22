using Microsoft.Extensions.Configuration;

namespace Infrastructure.Kafka;

public class KafkaProducerAdminClientStore : KafkaAdminClientStore
{
    public KafkaProducerAdminClientStore(IConfiguration configuration) : base(KafkaHost.Producer, configuration)
    {  }
}
