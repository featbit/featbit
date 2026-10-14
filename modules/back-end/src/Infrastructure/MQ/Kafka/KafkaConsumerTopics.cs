using Domain.Messages;

namespace Infrastructure.MQ.Kafka;

/// <summary>
/// The single definition of the topics <see cref="KafkaMessageConsumer"/> subscribes to.
/// </summary>
/// <remarks>
/// Hoisted out of the DI registration so the consumer-group diagnostic check
/// (<see cref="KafkaConsumerGroupHealthCheck"/>) measures the topics that are actually consumed
/// rather than a second, hand-maintained copy of the list. A diagnostic that silently stops
/// covering a topic when someone adds one to the consumer is worse than no diagnostic at all,
/// because it reports "no lag" for a topic it is not looking at.
/// </remarks>
public static class KafkaConsumerTopics
{
    public static readonly string[] All =
    [
        Topics.EndUser,
        Topics.Usage,
        ControlPlaneTopics.ControlPlaneWebHooks
    ];
}
