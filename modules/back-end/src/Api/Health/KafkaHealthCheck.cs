using Confluent.Kafka;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace Api.Health
{
    public class KafkaHealthCheck : IHealthCheck
    {
        private readonly IEnumerable<IAdminClient> _adminClients;
        private static readonly TimeSpan _timeoutFifteenSeconds = TimeSpan.FromSeconds(15);

        public KafkaHealthCheck(IConfiguration configuration)
        {
            _adminClients = configuration.GetKafkaHosts().Select(kafkaHost => 
            {
                var adminClientConfig = new AdminClientConfig(new Dictionary<string, string>
                {
                    { "bootstrap.servers", kafkaHost },
                });

                return new AdminClientBuilder(adminClientConfig).Build();
            }).ToList();
        }

        public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken cancellationToken = default)
        {
            try
            {
                foreach (var adminClient in _adminClients)
                {
                    await IsKafkaAvailableAsync(adminClient);
                }
            }
            catch (Exception exception)
            {
                return HealthCheckResult.Unhealthy("Kafka is currently unavailable.", exception);
            }

            return HealthCheckResult.Healthy("Kafka is currently available.");
        }

        private Task IsKafkaAvailableAsync(IAdminClient adminClient, CancellationToken cancellationToken = default)
        {
            adminClient.GetMetadata(_timeoutFifteenSeconds);
            return Task.CompletedTask;
        }
    }
}
