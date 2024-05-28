using Confluent.Kafka;
using Infrastructure.Readiness;

namespace Infrastructure.Kafka;

public class KafkaReadinessCheck : ReadinessCheck
{
    private static readonly TimeSpan _timeoutFifteenSeconds = TimeSpan.FromSeconds(15);
    
    public KafkaReadinessCheck
    (
        KafkaConsumerAdminClientStore consumerAdminClientStore,
        KafkaProducerAdminClientStore producerAdminClientStore
    )
        : base(healthyCheck: IsKafkaHealthy(consumerAdminClientStore.GetClient(), producerAdminClientStore.GetClient()), serviceName: "Kafka")
    {  }

    private static Func<Task<bool>> IsKafkaHealthy(IAdminClient consumerAdminClient, IAdminClient producerAdminClient)
    {
        return () =>
        {
            try
            {
                consumerAdminClient.GetMetadata(_timeoutFifteenSeconds);
                producerAdminClient.GetMetadata(_timeoutFifteenSeconds);

                return Task.FromResult(true);
            }
            catch(Exception)
            {
                return Task.FromResult(false);
            }
        };
    }
}
