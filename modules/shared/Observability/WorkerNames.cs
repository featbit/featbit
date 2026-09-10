#nullable enable

namespace Domain.Observability;

/// <summary>
/// Stable names for the background workers across the estate, reported on the
/// <see cref="ObservabilityTags.Worker"/> attribute.
/// </summary>
/// <remarks>
/// <para>
/// These are constants rather than <c>nameof</c> or <c>GetType().Name</c> on purpose: a class
/// rename would silently rename the metric series, breaking every dashboard and alert built on it
/// with no compile error and no test failure.
/// </para>
/// <para>
/// The names for all services live together deliberately. The worker vocabulary is estate-wide, so
/// keeping it in one place is what makes collisions visible at compile time; the alternative is
/// three lists that drift.
/// </para>
/// </remarks>
public static class WorkerNames
{
    /// <summary>Drains the insights channel and persists batches.</summary>
    public const string InsightsFlush = "insights_flush";

    /// <summary>Drains the usage channel and persists aggregated records.</summary>
    public const string UsageFlush = "usage_flush";

    /// <summary>Applies flag schedules whose scheduled time has passed.</summary>
    public const string FlagSchedule = "flag_schedule";

    /// <summary>Removes staged flag drafts that are no longer referenced.</summary>
    public const string StagedFlagGc = "staged_flag_gc";

    /// <summary>Kafka message-queue consumer loop.</summary>
    public const string KafkaConsumer = "mq_kafka_consumer";

    /// <summary>Redis message-queue consumer loop.</summary>
    public const string RedisConsumer = "mq_redis_consumer";

    /// <summary>Postgres message-queue consumer loop.</summary>
    public const string PostgresConsumer = "mq_postgres_consumer";

    /// <summary>Publishes this pod's heartbeat to the control plane.</summary>
    public const string Heartbeat = "heartbeat";

    /// <summary>Probes data-store availability and selects the store to serve from.</summary>
    public const string StoreSentinel = "store_sentinel";

    /// <summary>Samples message-queue backlog depth on a timer.</summary>
    public const string BacklogSampler = "mq_backlog_sampler";
}

/// <summary>
/// Stable names for the in-memory buffers across the estate, reported on the
/// <see cref="ObservabilityTags.Buffer"/> attribute.
/// </summary>
public static class BufferNames
{
    /// <summary>
    /// The insights ingest channel. Bounded with <c>FullMode.Wait</c>, so it back-pressures the
    /// calling request thread rather than dropping — blocked writers, not occupancy, are the signal.
    /// </summary>
    public const string Insights = "insights";

    /// <summary>The usage-record ingest channel.</summary>
    public const string Usage = "usage";

    /// <summary>
    /// The Postgres notification channel feeding the message consumer. In the evaluation server it
    /// is bounded with <c>DropOldest</c>, so it sheds load silently — drops, not occupancy, are the
    /// signal there.
    /// </summary>
    public const string PostgresNotifications = "postgres_notifications";
}
