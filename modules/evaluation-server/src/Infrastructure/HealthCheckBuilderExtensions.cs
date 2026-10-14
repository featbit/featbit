using Infrastructure.Caches;
using Infrastructure.Caches.Redis;
using Infrastructure.MQ;
using Infrastructure.MQ.Kafka;
using Infrastructure.Persistence;
using Infrastructure.Persistence.MongoDb;
using Infrastructure.Store;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace Infrastructure;

public static class HealthCheckBuilderExtensions
{
    private static readonly TimeSpan Timeout = TimeSpan.FromSeconds(5);

    public const string ReadinessTag = "Readiness";

    /// <summary>
    /// Checks answering "is this pod ready to accept its FIRST request?". Deliberately the same set
    /// as <see cref="ReadinessTag"/>: startup and readiness ask the same question of the same
    /// dependencies, they differ only in how long an orchestrator is willing to wait for the answer,
    /// and that is a probe-manifest concern rather than a code one. Tagging both here changes no
    /// existing behavior — <c>health/readiness</c> filters on <see cref="ReadinessTag"/> and is
    /// unaffected by the extra tag.
    /// </summary>
    public const string StartupTag = "Startup";

    /// <summary>
    /// Detail-rich checks that deliberately gate NOTHING. They are surfaced only on
    /// <c>health/diagnostics</c>, never on liveness or readiness, so a check here can be as
    /// expensive or as opinionated as it needs to be without any risk of pulling a healthy pod out
    /// of rotation. Promoting any of them into readiness is follow-up F3.
    /// </summary>
    public const string DiagnosticsTag = "Diagnostics";

    public static IHealthChecksBuilder AddReadinessChecks(
        this IHealthChecksBuilder builder,
        IConfiguration configuration)
    {
        var tags = new[] { ReadinessTag, StartupTag };

        var dbProvider = configuration.GetDbProvider();
        switch (dbProvider.Name)
        {
            case DbProvider.MongoDb:
                builder.AddMongoDb(
                    sp => sp.GetRequiredService<IMongoDbClient>().Database,
                    tags: tags,
                    timeout: Timeout
                );
                break;
            case DbProvider.Postgres:
                builder.AddNpgSql(tags: tags);
                break;
        }

        var mqProvider = configuration.GetMqProvider();
        if (mqProvider == MqProvider.Kafka)
        {
            builder.AddKafka(configuration, tags, Timeout);
        }

        var cacheProvider = configuration.GetCacheProvider();
        if (cacheProvider == CacheProvider.Redis)
        {
            builder.AddRedis(
                serviceProvider => serviceProvider.GetRequiredService<IRedisClient>().Connection,
                tags: tags,
                timeout: Timeout
            );
        }

        return builder;
    }

    /// <summary>
    /// Registers the non-gating diagnostic checks surfaced on <c>health/diagnostics</c>.
    /// </summary>
    /// <remarks>
    /// <para>
    /// Purely additive: nothing registered here carries <see cref="ReadinessTag"/> or
    /// <see cref="StartupTag"/>, so no existing probe's result can change.
    /// </para>
    /// <para>
    /// The eval server deliberately gets NO Kafka consumer-group progress check, unlike the API
    /// server. <c>KafkaMessageConsumer</c> mints a fresh <c>evaluation-server-{Guid}</c> group id on
    /// every process start, so its group has no history to be behind on and reported lag would be
    /// meaninglessly near zero regardless of the pod's actual health. That per-process group id is
    /// itself the defect (follow-up F12); adding a check that appears to measure progress but
    /// cannot is worse than having none, because it would be believed.
    /// </para>
    /// </remarks>
    public static IHealthChecksBuilder AddDiagnosticChecks(
        this IHealthChecksBuilder builder,
        IConfiguration configuration)
    {
        var diagnosticTags = new[] { DiagnosticsTag };

        builder.Services.TryAddSingleton<StoreAvailabilityHealthCheck>();
        builder.AddCheck<StoreAvailabilityHealthCheck>(
            "Store Availability",
            failureStatus: HealthStatus.Unhealthy,
            tags: diagnosticTags);

        return builder;
    }
}