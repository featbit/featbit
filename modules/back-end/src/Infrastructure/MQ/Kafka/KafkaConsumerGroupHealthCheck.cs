using Confluent.Kafka;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.Extensions.Logging;

namespace Infrastructure.MQ.Kafka;

/// <summary>
/// Diagnostic check reporting REAL Kafka consumer-group progress: per-partition committed offset,
/// high watermark, and the lag between them, summed per topic and across the group.
/// </summary>
/// <remarks>
/// <para>
/// This exists because the pre-existing "Kafka Consumer Cluster" readiness check
/// (<see cref="KafkaHealthCheckBuilderExtensions"/>) is built from a <see cref="ProducerConfig"/>
/// and produces to a throwaway topic. It therefore proves only that the broker is reachable — it
/// passes just as happily when the consumer group has stopped making progress entirely, which is
/// the failure operators actually care about. Fixing that check in place would change readiness
/// (a currently-passing pod could start failing on upgrade and leave rotation), so it is left
/// alone and recorded as a follow-up; this check is <b>Diagnostics-tagged only</b> and gates
/// nothing.
/// </para>
/// <para>
/// The broker work is done by <see cref="KafkaLagReader"/>, which is shared with the backlog gauge
/// so that this endpoint and that metric cannot report different numbers. It never joins the
/// consumer group. Nothing on a request, streaming, or evaluation path touches this type.
/// </para>
/// </remarks>
public sealed class KafkaConsumerGroupHealthCheck(
    KafkaLagReader lagReader,
    ILogger<KafkaConsumerGroupHealthCheck> logger) : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        if (!lagReader.IsConfigured)
        {
            return HealthCheckResult.Degraded(
                "Kafka:Consumer:group.id is not configured, so consumer-group progress cannot be read.");
        }

        try
        {
            var snapshot = await lagReader.ReadAsync(cancellationToken);

            return Describe(snapshot);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            // The exception TYPE is reported, never its message: broker error strings routinely
            // embed the bootstrap server list and SASL principal, and this endpoint's whole
            // purpose is to be readable by an operator.
            logger.LogWarning(ex, "Kafka consumer-group diagnostic check failed.");

            return HealthCheckResult.Unhealthy(
                $"Could not read consumer-group progress ({ex.GetType().Name}).");
        }
    }

    private HealthCheckResult Describe(KafkaLagSnapshot snapshot)
    {
        var data = new Dictionary<string, object>
        {
            ["group_id"] = lagReader.GroupId!,
            ["topics"] = string.Join(",", lagReader.Topics),
            ["partitions"] = snapshot.Partitions,
            ["total_lag"] = snapshot.TotalLag,
            ["uncommitted_partitions"] = snapshot.UncommittedPartitions
        };

        if (snapshot.Partitions == 0)
        {
            return HealthCheckResult.Degraded(
                "No partitions found for the consumed topics; the topics may not exist yet.",
                data: data);
        }

        foreach (var (topic, lag) in snapshot.LagByTopic)
        {
            data[$"lag.{topic}"] = lag;
        }

        return snapshot.UncommittedPartitions == snapshot.Partitions
            ? HealthCheckResult.Degraded(
                $"Consumer group '{lagReader.GroupId}' has never committed an offset for any of its " +
                $"{snapshot.Partitions} partition(s).",
                data: data)
            : HealthCheckResult.Healthy(
                $"Consumer group '{lagReader.GroupId}' is {snapshot.TotalLag} message(s) behind across " +
                $"{snapshot.Partitions} partition(s).",
                data);
    }
}
