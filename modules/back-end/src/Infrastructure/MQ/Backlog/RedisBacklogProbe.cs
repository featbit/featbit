using Domain.Observability;
using Infrastructure.Caches.Redis;
using Infrastructure.MQ.Redis;

namespace Infrastructure.MQ.Backlog;

/// <summary>
/// Reads the depth of the Redis lists this service drains, with <c>LLEN</c>.
/// </summary>
/// <remarks>
/// <para>
/// Only list-consumed topics are probed. Pub/sub channels have no backlog by construction — a
/// message published with no live subscriber is discarded rather than queued — so there is nothing
/// to count and a gauge for them would report a permanent zero that looks like a healthy queue.
/// <see cref="RedisConsumerTopics.All"/> is the same list the producer routes on and the consumer
/// drains, so the three cannot drift apart.
/// </para>
/// <para>
/// <c>LLEN</c> is O(1) in Redis, so this is the cheapest of the three probes.
/// </para>
/// </remarks>
public sealed class RedisBacklogProbe(IRedisClient redisClient) : IBacklogProbe
{
    public string Provider => MessagingSystems.Redis;

    public IReadOnlyList<string> Topics { get; } = RedisConsumerTopics.All;

    public async Task<IReadOnlyDictionary<string, long>> SampleAsync(CancellationToken cancellationToken)
    {
        var depths = new Dictionary<string, long>(Topics.Count, StringComparer.Ordinal);
        var database = redisClient.GetDatabase();

        foreach (var topic in Topics)
        {
            cancellationToken.ThrowIfCancellationRequested();

            // Per topic rather than in one batch: a single unreachable key should cost one unknown
            // reading, not the whole cycle.
            depths[topic] = await database.ListLengthAsync(topic);
        }

        return depths;
    }
}
