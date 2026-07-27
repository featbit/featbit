using Api.Application.ControlPlane;
using Confluent.Kafka;
using Domain.Messages;
using Infrastructure;
using Infrastructure.Caches.Redis;
using Infrastructure.MQ;
using Infrastructure.MQ.Kafka;
using Infrastructure.MQ.None;
using Infrastructure.MQ.Postgres;
using Infrastructure.MQ.Redis;
using Npgsql;

namespace Api.Infrastructure.MQ;

public static class MqServiceCollectionExtensions
{
    /// <summary>
    /// The <c>Kafka:Consumer:group.id</c> shipped in appsettings.json. Two control planes that
    /// both consume this unmodified default from the same Kafka broker collide: Kafka hands each
    /// topic-partition to exactly one member of the group, so only one DC's control plane
    /// processes flag/segment changes and heartbeats while the other silently idles (#100).
    /// </summary>
    public const string DefaultConsumerGroupId = "featbit-control-plane";

    /// <summary>
    /// Derives the effective Kafka consumer group id from the bound <c>Kafka:Consumer</c> config
    /// and the local DC identity (<c>Redis:Instances:0:DcId</c>).
    /// <list type="bullet">
    /// <item>Operator set a custom (non-default) group id: returned unchanged. Explicit
    /// configuration always wins — this is what <c>Deploy-FeatBitClusters.ps1</c> relies on when
    /// it sets a per-cluster literal group id directly.</item>
    /// <item>Group id is still the shipped default AND a non-empty local DcId is configured:
    /// suffix with "-{DcId}" so control planes in different DCs sharing a broker land in
    /// different consumer groups by default, without requiring an explicit override.</item>
    /// <item>Group id is the shipped default and no DcId is configured (single-DC/legacy
    /// deployments): returned unchanged — today's behavior is preserved.</item>
    /// </list>
    /// This is a pure function (no logging) so it stays trivially unit-testable; effective group
    /// id is observable at startup via the Kafka consumer's own logging.
    /// </summary>
    public static string ResolveConsumerGroupId(IConfiguration configuration, string boundGroupId)
    {
        if (boundGroupId != DefaultConsumerGroupId)
        {
            return boundGroupId;
        }

        var dcId = configuration["Redis:Instances:0:DcId"];
        return string.IsNullOrEmpty(dcId) ? boundGroupId : $"{boundGroupId}-{dcId}";
    }

    /// <summary>
    /// #105: true when this deployment shape leaves TWO OR MORE control planes sharing the
    /// unmodified default Kafka <c>group.id</c> with no way to self-differentiate — a multi-instance
    /// configuration (<c>Redis:Instances</c> has more than one entry, i.e. this control plane knows
    /// about at least one peer DC) whose LOCAL DC id (<c>Redis:Instances:0:DcId</c>) is empty, so
    /// <see cref="ResolveConsumerGroupId"/>'s suffixing above never triggers. Every control plane
    /// deployed this same way resolves the identical default <c>group.id</c>, reproducing #100's
    /// collision (only one DC's control plane processes flag/segment changes and heartbeats; the
    /// others silently idle) even though the deployment IS multi-DC-aware (peers ARE configured) —
    /// it is simply missing the DcId that would let it self-differentiate. Suffixing by Redis
    /// instance INDEX instead of DcId would NOT fix this: each peer's own local instance is always
    /// index 0 in ITS OWN configuration, so every cluster would still resolve "-0".
    /// <para>
    /// Pure/side-effect-free (no logging) so it is trivially unit-testable; the actual warning is
    /// emitted by <see cref="KafkaConsumerGroupIdCollisionGuard"/>, deferred to first-use logging
    /// (see <c>AddKafka</c> below for why).
    /// </para>
    /// </summary>
    public static bool IsMultiInstanceDefaultGroupIdCollisionRisk(
        IConfiguration configuration,
        string effectiveGroupId)
    {
        if (effectiveGroupId != DefaultConsumerGroupId)
        {
            return false;
        }

        var instanceCount = configuration.GetSection("Redis:Instances").GetChildren().Count();
        if (instanceCount <= 1)
        {
            return false;
        }

        var dcId = configuration["Redis:Instances:0:DcId"];
        return string.IsNullOrEmpty(dcId);
    }

    public static void AddMq(this IServiceCollection services, IConfiguration configuration)
    {
        var mqProvider = configuration.GetMqProvider();
        
        var topics = new[]
        {
            ControlPlaneTopics.ControlPlaneFeatureFlagChange, ControlPlaneTopics.ControlPlaneLicenseChange,
            ControlPlaneTopics.ControlPlaneSecretChange, ControlPlaneTopics.ControlPlaneSegmentChange,
            ControlPlaneTopics.ConnectionMade, ControlPlaneTopics.ConnectionClosed, ControlPlaneTopics.PodHeartbeat,
        };
        
        services.AddKeyedTransient<IMessageHandler, FeatureFlagChangeMessageHandler>(
            ControlPlaneTopics.ControlPlaneFeatureFlagChange);
        services.AddKeyedTransient<IMessageHandler, LicenseChangeMessageHandler>(ControlPlaneTopics.ControlPlaneLicenseChange);
        services.AddKeyedTransient<IMessageHandler, SecretChangeMessageHandler>(ControlPlaneTopics.ControlPlaneSecretChange);
        services.AddKeyedTransient<IMessageHandler, SegmentChangeMessageHandler>(ControlPlaneTopics.ControlPlaneSegmentChange);
        services.AddKeyedTransient<IMessageHandler, ClientConnectionMadeHandler>(ControlPlaneTopics.ConnectionMade);
        services.AddKeyedTransient<IMessageHandler, ClientConnectionClosedHandler>(ControlPlaneTopics.ConnectionClosed);
        services.AddKeyedTransient<IMessageHandler, HeartbeatMessageHandler>(ControlPlaneTopics.PodHeartbeat);
      
        switch (mqProvider)
        {
            case MqProvider.None:
                AddNone();
                break;
            case MqProvider.Redis:
                AddRedis();
                break;
            case MqProvider.Kafka:
                AddKafka();
                break;
            case MqProvider.Postgres:
                AddPostgres();
                break;
        }
        
        return;

        void AddNone()
        {
            services.AddSingleton<IMessageProducer, NoneMessageProducer>();
        }

        void AddRedis()
        {
            services.TryAddRedis(configuration);

            services.AddSingleton<IMessageProducer, RedisMessageProducer>();
            services.AddHostedService(sp =>
            {
                var redisClient = sp.GetRequiredService<IRedisClient>();
                var logger = sp.GetRequiredService<ILogger<RedisMessageConsumer>>();

                return new RedisMessageConsumer(redisClient, sp, logger, topics);
            });
        }

        void AddKafka()
        {
            var producerConfigDictionary = new Dictionary<string, string>();
            configuration.GetSection("Kafka:Producer").Bind(producerConfigDictionary);
            var producerConfig = new ProducerConfig(producerConfigDictionary);
            services.AddSingleton(producerConfig);

            var consumerConfigDictionary = new Dictionary<string, string>();
            configuration.GetSection("Kafka:Consumer").Bind(consumerConfigDictionary);
            var consumerConfig = new ConsumerConfig(consumerConfigDictionary);

            // Resolve a per-DC group.id when the operator left the shipped default in place
            // (#100). A custom group.id explicitly configured — e.g. by
            // Deploy-FeatBitClusters.ps1's per-cluster literals — is never touched.
            // No ILogger is available yet at this point in service registration, so the
            // resolved value isn't logged here; KafkaMessageConsumer's own "Start consuming
            // messages for {Topics}..." startup log plus the Confluent.Kafka client's debug
            // logging make the effective group.id observable without adding a registration-time
            // logging dependency for what is a pure, easily unit-tested config transform.
            if (!string.IsNullOrEmpty(consumerConfig.GroupId))
            {
                consumerConfig.GroupId = ResolveConsumerGroupId(configuration, consumerConfig.GroupId);
            }

            services.AddSingleton(consumerConfig);

            services.AddSingleton<IMessageProducer, KafkaMessageProducer>();

            // #105: the multi-instance + empty-local-DcId + still-default-group.id shape (see
            // IsMultiInstanceDefaultGroupIdCollisionRisk above) reproduces #100's collision even on
            // a deployment that IS multi-DC-aware. Still no ILogger available at this point in
            // registration, so the warning is deferred to a tiny one-shot IHostedService that runs
            // once real DI (and a logger) is available at startup, instead of being silently
            // skipped like ResolveConsumerGroupId's result above.
            if (IsMultiInstanceDefaultGroupIdCollisionRisk(configuration, consumerConfig.GroupId))
            {
                services.AddHostedService(sp => new KafkaConsumerGroupIdCollisionGuard(
                    sp.GetRequiredService<ILogger<KafkaConsumerGroupIdCollisionGuard>>(),
                    consumerConfig.GroupId));
            }

            services.AddHostedService(sp =>
            {
                var cfg = sp.GetRequiredService<ConsumerConfig>();
                var logger = sp.GetRequiredService<ILogger<KafkaMessageConsumer>>();
                var provider = sp.GetRequiredService<IServiceProvider>();

                return new KafkaMessageConsumer(cfg, provider, logger, topics);
            });
        }

        void AddPostgres()
        {
            services.TryAddPostgres(configuration);

            services.AddSingleton<IMessageProducer, PostgresMessageProducer>(sp =>
            {
                var dataSource = sp.GetRequiredService<NpgsqlDataSource>();
                var logger = sp.GetRequiredService<ILogger<PostgresMessageProducer>>();

                return new PostgresMessageProducer(dataSource, logger);
            });
            services.AddHostedService(sp =>
            {
                var scopeFactory = sp.GetRequiredService<IServiceScopeFactory>();
                var dataSource = sp.GetRequiredService<NpgsqlDataSource>();
                var logger = sp.GetRequiredService<ILogger<PostgresMessageConsumer>>();

                return new PostgresMessageConsumer(scopeFactory, dataSource, logger, topics);
            });
        }
    }
}

/// <summary>
/// #105: one-shot startup warning for the multi-instance + empty-local-DcId + still-default
/// Kafka <c>group.id</c> deployment shape (see
/// <see cref="MqServiceCollectionExtensions.IsMultiInstanceDefaultGroupIdCollisionRisk"/>). Exists
/// only because no <see cref="ILogger"/> is available at the point in DI service registration
/// where that shape is detected (<c>AddKafka</c>) — this runs once real DI is up, logs, and exits.
/// Deliberately NOT a <see cref="BackgroundService"/> loop; only registered when the risky shape is
/// actually detected, so it costs nothing on every other deployment.
/// </summary>
internal sealed class KafkaConsumerGroupIdCollisionGuard(
    ILogger<KafkaConsumerGroupIdCollisionGuard> logger,
    string groupId) : IHostedService
{
    public Task StartAsync(CancellationToken cancellationToken)
    {
        logger.LogWarning(
            "Kafka consumer group.id is still the shipped default ('{GroupId}') on a multi-instance " +
            "deployment (Redis:Instances has more than one entry, i.e. at least one peer DC is " +
            "configured) whose LOCAL DC id (Redis:Instances:0:DcId) is EMPTY. Every control plane " +
            "deployed this way resolves the SAME group.id, so Kafka hands each topic-partition to " +
            "only ONE of them while the others silently idle (#100) -- this will NOT self-resolve by " +
            "suffixing on Redis instance index, since each peer's own local instance is always index " +
            "0 in ITS OWN configuration. Set Redis:Instances:0:DcId (or an explicit " +
            "Kafka:Consumer:group.id) to a distinct value on every cluster.",
            groupId);

        return Task.CompletedTask;
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}