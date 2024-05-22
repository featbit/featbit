using Confluent.Kafka;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace Infrastructure.Kafka;

public class KafkaReadinessCheck : IHealthCheck
{
    private static readonly string _producerConfigSection = "Kafka:Producer";
    private static readonly string _consumerConfigSection = "Kafka:Consumer";
    private static readonly string _serverConfigSection = "bootstrap.servers";
    private static readonly TimeSpan _timeoutFifteenSeconds = TimeSpan.FromSeconds(15);

    private readonly IEnumerable<IAdminClient> _adminClients;

    public KafkaReadinessCheck(IConfiguration configuration)
    {
        _adminClients = GetKafkaHosts(configuration).Select(kafkaHost => 
        {
            var adminClientConfig = new AdminClientConfig(new Dictionary<string, string>
            {
                { "bootstrap.servers", kafkaHost },
            });

            return new AdminClientBuilder(adminClientConfig).Build();
        }).ToList();
    }

    public Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken cancellationToken = default)
    {
        try
        {
            foreach (var adminClient in _adminClients)
            {
                adminClient.GetMetadata(_timeoutFifteenSeconds);
            }
        }
        catch (Exception exception)
        {
            return Task.FromResult(HealthCheckResult.Unhealthy("Kafka is currently unavailable.", exception));
        }

        return Task.FromResult(HealthCheckResult.Healthy("Kafka is currently available."));
    }

    private IEnumerable<string> GetKafkaHosts(IConfiguration configuration)
    {
        var resultSet = new HashSet<string>();

        var producerConfigDictionary = new Dictionary<string, string>();
        configuration.GetSection(_producerConfigSection).Bind(producerConfigDictionary);
        var producerHost = producerConfigDictionary[_serverConfigSection];

        if (producerHost != null)
        {
            resultSet.Add(producerHost);
        }

        var consumerConfigDictionary = new Dictionary<string, string>();
        configuration.GetSection(_consumerConfigSection).Bind(consumerConfigDictionary);
        var consumerHost = consumerConfigDictionary[_serverConfigSection];

        if (consumerHost != null)
        {
            resultSet.Add(consumerHost);
        }

        return resultSet;
    }
}
