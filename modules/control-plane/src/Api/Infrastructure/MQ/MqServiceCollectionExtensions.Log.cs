using Microsoft.Extensions.Logging;

namespace Api.Infrastructure.MQ;

internal sealed partial class KafkaConsumerGroupIdCollisionGuard
{
    public static partial class Log
    {
        [LoggerMessage(1, LogLevel.Warning,
            "Kafka consumer group.id is still the shipped default ('{GroupId}') on a multi-instance " +
            "deployment (Redis:Instances has more than one entry, i.e. at least one peer DC is " +
            "configured) whose LOCAL DC id (Redis:Instances:0:DcId) is EMPTY. Every control plane " +
            "deployed this way resolves the SAME group.id, so Kafka hands each topic-partition to " +
            "only ONE of them while the others silently idle (#100) -- this will NOT self-resolve by " +
            "suffixing on Redis instance index, since each peer's own local instance is always index " +
            "0 in ITS OWN configuration. Set Redis:Instances:0:DcId (or an explicit " +
            "Kafka:Consumer:group.id) to a distinct value on every cluster.",
            EventName = "KafkaGroupIdCollision")]
        public static partial void KafkaGroupIdCollision(ILogger logger, string groupId);
    }
}