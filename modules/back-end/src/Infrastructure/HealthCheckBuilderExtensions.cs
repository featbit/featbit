using Infrastructure.Caches;
using Infrastructure.Caches.Redis;
using Infrastructure.MQ;
using Infrastructure.MQ.Kafka;
using Infrastructure.Persistence;
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
        if (dbProvider.Name == DbProvider.MongoDb)
        {
            builder.AddMongoDb(
                sp => sp.GetRequiredService<MongoDbClient>().Database,
                tags: tags,
                timeout: Timeout
            );
        }
        else
        {
            builder.AddDbContextCheck<AppDbContext>(tags: tags);
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
    /// Purely additive: nothing registered here carries <see cref="ReadinessTag"/> or
    /// <see cref="StartupTag"/>, so no existing probe's result can change. Each check must be safe
    /// to run on demand and must never mutate state.
    /// </remarks>
    public static IHealthChecksBuilder AddDiagnosticChecks(
        this IHealthChecksBuilder builder,
        IConfiguration configuration)
    {
        var diagnosticTags = new[] { DiagnosticsTag };

        if (configuration.GetMqProvider() == MqProvider.Kafka)
        {
            // Singleton so the endpoint can be polled without churning a broker connection per
            // request; AddCheck resolves the registered instance rather than constructing a new one.
            builder.Services.TryAddSingleton<KafkaConsumerGroupHealthCheck>();
            builder.AddCheck<KafkaConsumerGroupHealthCheck>(
                "Kafka Consumer Group Progress",
                failureStatus: HealthStatus.Unhealthy,
                tags: diagnosticTags);
        }

        return builder;
    }
}