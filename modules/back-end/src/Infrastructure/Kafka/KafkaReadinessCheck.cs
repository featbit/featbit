using Confluent.Kafka;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace Infrastructure.Kafka;

public class KafkaReadinessCheck : IHealthCheck
{
    private readonly IAdminClient _consumerAdminClient;

    public KafkaReadinessCheck(KafkaConsumerAdminClientStore consumerAdminClientStore)
    {
        _consumerAdminClient = consumerAdminClientStore.GetAdminClient();
    }

    public Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken cancellationToken = default)
    {
        return Task.Run(() =>
        {
            try
            {
                _consumerAdminClient.GetMetadata(TimeSpan.FromSeconds(15));
            }
            catch (Exception exception)
            {
                return Task.FromResult(HealthCheckResult.Unhealthy("Kafka is currently unavailable.", exception));
            }

            return Task.FromResult(HealthCheckResult.Healthy("Kafka is currently available."));
        }).WaitAsync(cancellationToken);
    }
}
