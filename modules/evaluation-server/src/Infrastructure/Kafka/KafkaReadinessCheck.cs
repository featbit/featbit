using Confluent.Kafka;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace Infrastructure.Kafka;

public class KafkaReadinessCheck : IHealthCheck
{
    private static readonly TimeSpan _timeoutFifteenSeconds = TimeSpan.FromSeconds(15);
    private readonly IAdminClient _consumerAdminClient;

    public KafkaReadinessCheck(KafkaConsumerAdminClientStore consumerAdminClientStore)
    {
        _consumerAdminClient = consumerAdminClientStore.GetAdminClient();
    }

    public Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken cancellationToken = default)
    {
        return Task.Run(() => {
            try
            {
                _consumerAdminClient.GetMetadata(_timeoutFifteenSeconds);

                return Task.FromResult(HealthCheckResult.Healthy("The Kafka consumer is available."));
            }
            catch (Exception exception)
            {
                return Task.FromResult(HealthCheckResult.Unhealthy("The Kafka consumer is unavailable.", exception));
            }
        }).WaitAsync(cancellationToken);
    }
}
