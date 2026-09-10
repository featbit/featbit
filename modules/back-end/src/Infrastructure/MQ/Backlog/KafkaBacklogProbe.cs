using Domain.Observability;
using Infrastructure.MQ.Kafka;

namespace Infrastructure.MQ.Backlog;

/// <summary>
/// Reports Kafka consumer-group lag as the backlog depth for each consumed topic.
/// </summary>
/// <remarks>
/// <para>
/// Lag — committed offset versus high watermark — is the Kafka equivalent of queue depth: it is the
/// number of messages produced that this group has not yet acknowledged. It is read through the
/// same <see cref="KafkaLagReader"/> the diagnostic health check uses, so the gauge and the
/// endpoint always agree.
/// </para>
/// <para>
/// A topic whose partitions have no committed offset is omitted rather than reported as zero. The
/// group has never acknowledged anything there, so its backlog is genuinely unknown — and on a
/// long-running deployment that state is itself a problem, which a zero would hide.
/// </para>
/// </remarks>
public sealed class KafkaBacklogProbe(KafkaLagReader lagReader) : IBacklogProbe
{
    public string Provider => MessagingSystems.Kafka;

    public IReadOnlyList<string> Topics { get; } = lagReader.Topics;

    public async Task<IReadOnlyDictionary<string, long>> SampleAsync(CancellationToken cancellationToken)
    {
        if (!lagReader.IsConfigured)
        {
            // No group id means there is no group whose progress could be read. Returning empty
            // reports every topic as unknown, which is the truth.
            return new Dictionary<string, long>(StringComparer.Ordinal);
        }

        var snapshot = await lagReader.ReadAsync(cancellationToken);

        return snapshot.LagByTopic;
    }
}
