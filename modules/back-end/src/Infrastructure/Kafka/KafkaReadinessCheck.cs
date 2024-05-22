using Confluent.Kafka;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace Infrastructure.Kafka;

public class KafkaReadinessCheck : IHealthCheck
{
    private static readonly TimeSpan _timeoutFifteenSeconds = TimeSpan.FromSeconds(15);
    private readonly IAdminClient _consumerAdminClient;
    private readonly IAdminClient _producerAdminClient;

    public KafkaReadinessCheck(
        KafkaConsumerAdminClientStore consumerAdminClientStore, 
        KafkaProducerAdminClientStore producerAdminClientStore
    )
    {
        _consumerAdminClient = consumerAdminClientStore.GetClient();
        _producerAdminClient = producerAdminClientStore.GetClient();
    }

    public Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken cancellationToken = default)
    {
        try
        {
            _consumerAdminClient.GetMetadata(_timeoutFifteenSeconds);
            _producerAdminClient.GetMetadata(_timeoutFifteenSeconds);
        }
        catch (Exception exception)
        {
            return Task.FromResult(HealthCheckResult.Unhealthy("Kafka is currently unavailable.", exception));
        }

        return Task.FromResult(HealthCheckResult.Healthy("Kafka is currently available."));
    }
}
