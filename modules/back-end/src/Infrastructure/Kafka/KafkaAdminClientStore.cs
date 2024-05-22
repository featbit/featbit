using Confluent.Kafka;
using Microsoft.Extensions.Configuration;

namespace Infrastructure.Kafka;

public enum KafkaHost
{ 
    Producer,
    Consumer,
};

public class KafkaAdminClientStore
{
    private readonly IAdminClient _adminClient;

    public KafkaAdminClientStore(KafkaHost kafkaHost, IConfiguration configuration)
    {
        var configSection = kafkaHost switch
        {
            KafkaHost.Producer => "Kafka:Producer",
            _ => "Kafka:Consumer",
        };

        var outputDictionary = new Dictionary<string, string>();
        configuration.GetSection(configSection).Bind(outputDictionary);
        var adminClientConfig = new AdminClientConfig(outputDictionary);

        _adminClient = new AdminClientBuilder(adminClientConfig).Build();
    }

    public virtual IAdminClient GetClient() => _adminClient;
}
