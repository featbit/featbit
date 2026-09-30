using Domain.Messages;

namespace Infrastructure.MQ.Postgres;

/// <summary>
/// The single definition of the topics <see cref="PostgresMessageConsumer"/> drains from
/// <c>queue_messages</c>.
/// </summary>
/// <remarks>
/// This list was previously written inline at the DI registration and repeated nowhere else, which
/// meant the backlog probe would have had to restate it — and a backlog gauge that watches a
/// different set of topics from the consumer is worse than no gauge, because it reports a drained
/// queue for a topic nobody is draining. Unlike the Redis transport there is no list-versus-pub/sub
/// asymmetry here: every Postgres topic is a row in the same table.
/// </remarks>
public static class PostgresConsumerTopics
{
    public static readonly string[] All =
    [
        Topics.EndUser,
        Topics.Insights,
        Topics.Usage,
        ControlPlaneTopics.ControlPlaneWebHooks
    ];
}
