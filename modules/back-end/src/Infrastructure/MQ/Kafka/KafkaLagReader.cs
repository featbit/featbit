using Confluent.Kafka;
using Microsoft.Extensions.Logging;

namespace Infrastructure.MQ.Kafka;

/// <summary>
/// One reading of consumer-group progress: how far behind the group is, per topic and in total.
/// </summary>
/// <param name="Partitions">Partitions discovered across the consumed topics.</param>
/// <param name="UncommittedPartitions">
/// Partitions for which the group has never committed an offset. Normal for a brand-new deployment
/// and abnormal for a long-running one, so it is kept separate rather than folded into zero lag.
/// </param>
/// <param name="TotalLag">Sum of per-partition lag across every committed partition.</param>
/// <param name="LagByTopic">
/// Lag per topic. A topic is absent when none of its partitions has a committed offset — absent
/// means unknown, not zero.
/// </param>
public sealed record KafkaLagSnapshot(
    int Partitions,
    int UncommittedPartitions,
    long TotalLag,
    IReadOnlyDictionary<string, long> LagByTopic);

/// <summary>
/// Reads Kafka consumer-group lag without joining the group.
/// </summary>
/// <remarks>
/// <para>
/// A consumer is constructed from a defensive copy of the group's configuration but is never
/// <c>Subscribe</c>d or <c>Assign</c>ed, so no rebalance is triggered: <c>Committed</c> issues a
/// plain OffsetFetch to the group coordinator and <c>QueryWatermarkOffsets</c> a plain ListOffsets
/// to the partition leader. The consumer is held for the lifetime of this instance and reused, so
/// repeated reads do not churn broker connections.
/// </para>
/// <para>
/// Every librdkafka call here is synchronous and blocking, so <see cref="Read"/> must never be
/// called from a request, streaming, or evaluation path. Use <see cref="ReadAsync"/>, which moves
/// the work to the thread pool, and call it only from a health-check endpoint or a background
/// sampler.
/// </para>
/// <para>
/// This type exists so that the diagnostic health check and the backlog gauge report the same
/// number from the same broker connection. They were written separately at first, and two
/// independently-computed answers to "how far behind is this consumer" is precisely the kind of
/// disagreement that costs an hour during an incident.
/// </para>
/// </remarks>
public sealed partial class KafkaLagReader : IDisposable
{
    private static readonly TimeSpan MetadataTimeout = TimeSpan.FromSeconds(5);
    private static readonly TimeSpan OffsetTimeout = TimeSpan.FromSeconds(3);
    private static readonly TimeSpan WatermarkTimeout = TimeSpan.FromSeconds(2);

    private readonly ConsumerConfig _config;
    private readonly ILogger<KafkaLagReader> _logger;
    private readonly Lock _gate = new();

    private IConsumer<Ignore, Ignore>? _consumer;
    private bool _disposed;

    public KafkaLagReader(ConsumerConfig config, ILogger<KafkaLagReader> logger)
        : this(config, KafkaConsumerTopics.All, logger)
    {
    }

    internal KafkaLagReader(ConsumerConfig config, string[] topics, ILogger<KafkaLagReader> logger)
    {
        _config = config;
        Topics = topics;
        _logger = logger;
    }

    /// <summary>Topics this reader reports on.</summary>
    public string[] Topics { get; }

    /// <summary>The consumer group being observed, or <c>null</c> when none is configured.</summary>
    public string? GroupId => _config.GroupId;

    /// <summary>Whether a group id is configured. Without one there is no progress to read.</summary>
    public bool IsConfigured => !string.IsNullOrWhiteSpace(_config.GroupId);

    /// <summary>Reads lag on the thread pool, bounded by <paramref name="cancellationToken"/>.</summary>
    public Task<KafkaLagSnapshot> ReadAsync(CancellationToken cancellationToken = default)
        => Task.Run(Read, cancellationToken);

    /// <summary>
    /// Reads lag synchronously. Blocks on broker I/O — see the remarks on this type.
    /// </summary>
    public KafkaLagSnapshot Read()
    {
        var consumer = GetOrCreateConsumer();

        using var admin = new DependentAdminClientBuilder(consumer.Handle).Build();

        var partitions = new List<TopicPartition>();
        foreach (var topic in Topics)
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
            return new KafkaLagSnapshot(0, 0, 0, new Dictionary<string, long>(StringComparer.Ordinal));
        }

        var committed = consumer.Committed(partitions, OffsetTimeout);

        long totalLag = 0;
        var uncommittedPartitions = 0;
        var lagByTopic = new Dictionary<string, long>(StringComparer.Ordinal);

        foreach (var offset in committed)
        {
            if (offset.Offset == Offset.Unset)
            {
                uncommittedPartitions++;
                continue;
            }

            var watermarks = consumer.QueryWatermarkOffsets(offset.TopicPartition, WatermarkTimeout);
            var lag = Math.Max(0, watermarks.High.Value - offset.Offset.Value);

            totalLag += lag;
            lagByTopic[offset.Topic] = lagByTopic.GetValueOrDefault(offset.Topic) + lag;
        }

        return new KafkaLagSnapshot(partitions.Count, uncommittedPartitions, totalLag, lagByTopic);
    }

    private IConsumer<Ignore, Ignore> GetOrCreateConsumer()
    {
        lock (_gate)
        {
            ObjectDisposedException.ThrowIf(_disposed, this);

            if (_consumer is not null)
            {
                return _consumer;
            }

            // A defensive copy, taken lazily on first read rather than at construction. Copying is
            // the difference between a read-only diagnostic and an accidental behavior change: the
            // live ConsumerConfig is a DI singleton shared with the running consumer, so setting
            // group id or auto-commit on it here would reconfigure the real consumer.
            //
            // Lazy, because the evaluation server assigns its group id (`evaluation-server-{guid}`)
            // onto that shared instance when its consumer is constructed. Copying at construction
            // would make this reader's answer depend on DI resolution order, which is exactly the
            // kind of dependency that works on one machine and reports an empty group on another.
            var config = new ConsumerConfig(new Dictionary<string, string>(_config))
            {
                EnableAutoCommit = false,
                // Never create the group or a topic as a side effect of observing it.
                AllowAutoCreateTopics = false
            };

            return _consumer = new ConsumerBuilder<Ignore, Ignore>(config)
                // librdkafka reports transient connectivity through the error handler; without one
                // it writes to stderr, which bypasses Serilog entirely.
                .SetErrorHandler((_, error) =>
                    Log.ReaderError(_logger, error.Code))
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
