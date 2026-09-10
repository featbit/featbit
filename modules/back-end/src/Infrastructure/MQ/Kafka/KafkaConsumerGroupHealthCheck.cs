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
/// alone and recorded as follow-up F3; this check is <b>Diagnostics-tagged only</b> and gates
/// nothing.
/// </para>
/// <para>
/// It never joins the consumer group. A consumer is constructed from a defensive copy of the
/// group's configuration but is never <c>Subscribe</c>d or <c>Assign</c>ed, so no rebalance is
/// triggered; <c>Committed</c> issues a plain OffsetFetch to the group coordinator and
/// <c>QueryWatermarkOffsets</c> a plain ListOffsets to the partition leader. The consumer is held
/// as a singleton and reused so that repeated polling of the endpoint does not churn broker
/// connections.
/// </para>
/// <para>
/// All librdkafka calls here are synchronous and blocking, so the whole probe runs on the thread
/// pool via <see cref="Task.Run(Func{Task}, CancellationToken)"/> and every call is bounded by an
/// explicit timeout. Nothing on a request, streaming, or evaluation path touches this type.
/// </para>
/// </remarks>
public sealed class KafkaConsumerGroupHealthCheck : IHealthCheck, IDisposable
{
    private static readonly TimeSpan MetadataTimeout = TimeSpan.FromSeconds(5);
    private static readonly TimeSpan OffsetTimeout = TimeSpan.FromSeconds(3);
    private static readonly TimeSpan WatermarkTimeout = TimeSpan.FromSeconds(2);

    private readonly ConsumerConfig _config;
    private readonly string[] _topics;
    private readonly ILogger<KafkaConsumerGroupHealthCheck> _logger;
    private readonly Lock _gate = new();

    private IConsumer<Ignore, Ignore>? _consumer;
    private bool _disposed;

    public KafkaConsumerGroupHealthCheck(
        ConsumerConfig config,
        ILogger<KafkaConsumerGroupHealthCheck> logger)
        : this(config, KafkaConsumerTopics.All, logger)
    {
    }

    internal KafkaConsumerGroupHealthCheck(
        ConsumerConfig config,
        string[] topics,
        ILogger<KafkaConsumerGroupHealthCheck> logger)
    {
        // A defensive copy: the live ConsumerConfig is a DI singleton shared with the running
        // consumer, and mutating it here (group id, auto-commit) would reconfigure the real
        // consumer on its next rebuild. Copying is the difference between a read-only diagnostic
        // and an accidental behavior change.
        _config = new ConsumerConfig(new Dictionary<string, string>(config))
        {
            EnableAutoCommit = false,
            // Never create the group as a side effect of observing it.
            AllowAutoCreateTopics = false
        };

        _topics = topics;
        _logger = logger;
    }

    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(_config.GroupId))
        {
            return HealthCheckResult.Degraded(
                "Kafka:Consumer:group.id is not configured, so consumer-group progress cannot be read.");
        }

        try
        {
            return await Task.Run(Probe, cancellationToken);
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
            _logger.LogWarning(ex, "Kafka consumer-group diagnostic check failed.");

            return HealthCheckResult.Unhealthy(
                $"Could not read consumer-group progress ({ex.GetType().Name}).");
        }
    }

    private HealthCheckResult Probe()
    {
        var consumer = GetOrCreateConsumer();

        using var admin = new DependentAdminClientBuilder(consumer.Handle).Build();

        var partitions = new List<TopicPartition>();
        foreach (var topic in _topics)
        {
            var metadata = admin.GetMetadata(topic, MetadataTimeout);

            partitions.AddRange(
                from t in metadata.Topics
                where t.Error.Code == ErrorCode.NoError
                from p in t.Partitions
                select new TopicPartition(t.Topic, new Partition(p.PartitionId)));
        }

        if (partitions.Count == 0)
        {
            return HealthCheckResult.Degraded(
                "No partitions found for the consumed topics; the topics may not exist yet.",
                data: BaseData(0, 0, 0));
        }

        var committed = consumer.Committed(partitions, OffsetTimeout);

        var data = new Dictionary<string, object>
        {
            ["group_id"] = _config.GroupId!,
            ["topics"] = string.Join(",", _topics),
            ["partitions"] = partitions.Count
        };

        long totalLag = 0;
        var unknownPartitions = 0;
        var lagByTopic = new Dictionary<string, long>(StringComparer.Ordinal);

        foreach (var offset in committed)
        {
            // Unset means the group has never committed for this partition. That is normal for a
            // brand-new deployment and abnormal for a long-running one, so it is surfaced as its
            // own count rather than silently folded into "zero lag".
            if (offset.Offset == Offset.Unset)
            {
                unknownPartitions++;
                continue;
            }

            var watermarks = consumer.QueryWatermarkOffsets(offset.TopicPartition, WatermarkTimeout);
            var lag = Math.Max(0, watermarks.High.Value - offset.Offset.Value);

            totalLag += lag;
            lagByTopic[offset.Topic] = lagByTopic.GetValueOrDefault(offset.Topic) + lag;
        }

        data["total_lag"] = totalLag;
        data["uncommitted_partitions"] = unknownPartitions;
        foreach (var (topic, lag) in lagByTopic)
        {
            data[$"lag.{topic}"] = lag;
        }

        var description =
            $"Consumer group '{_config.GroupId}' is {totalLag} message(s) behind across " +
            $"{partitions.Count} partition(s).";

        return unknownPartitions == partitions.Count
            ? HealthCheckResult.Degraded(
                $"Consumer group '{_config.GroupId}' has never committed an offset for any of its " +
                $"{partitions.Count} partition(s).",
                data: data)
            : HealthCheckResult.Healthy(description, data);
    }

    private Dictionary<string, object> BaseData(long totalLag, int partitions, int uncommitted) =>
        new()
        {
            ["group_id"] = _config.GroupId!,
            ["topics"] = string.Join(",", _topics),
            ["partitions"] = partitions,
            ["total_lag"] = totalLag,
            ["uncommitted_partitions"] = uncommitted
        };

    private IConsumer<Ignore, Ignore> GetOrCreateConsumer()
    {
        lock (_gate)
        {
            ObjectDisposedException.ThrowIf(_disposed, this);

            return _consumer ??= new ConsumerBuilder<Ignore, Ignore>(_config)
                // librdkafka reports transient connectivity through the error handler; without one
                // it writes to stderr, which bypasses Serilog entirely.
                .SetErrorHandler((_, error) =>
                    _logger.LogDebug(
                        "Kafka consumer-group diagnostic client reported {ErrorCode}.", error.Code))
                .Build();
        }
    }

    public void Dispose()
    {
        lock (_gate)
        {
            if (_disposed)
            {
                return;
            }

            _disposed = true;

            // No Close(): this consumer never joined the group, so there is nothing to leave and
            // no offsets to commit.
            _consumer?.Dispose();
            _consumer = null;
        }
    }
}
