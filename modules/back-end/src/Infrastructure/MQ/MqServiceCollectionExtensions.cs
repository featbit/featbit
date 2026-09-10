using Confluent.Kafka;
using Domain.Messages;
using Infrastructure.Caches.Redis;
using Infrastructure.MQ.Backlog;
using Infrastructure.MQ.Kafka;
using Infrastructure.MQ.None;
using Infrastructure.MQ.Postgres;
using Infrastructure.MQ.Redis;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Logging;
using Npgsql;

namespace Infrastructure.MQ;

public static class MqServiceCollectionExtensions
{
    public static void AddMq(this IServiceCollection services, IConfiguration configuration)
    {
        var mqProvider = configuration.GetMqProvider();

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

        AddMessageHandlers();

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

                // Same list the producer routes on, so the two cannot drift apart.
                return new RedisMessageConsumer(redisClient, sp, logger, RedisConsumerTopics.All);
            });

            AddBacklogSampler(sp => new RedisBacklogProbe(sp.GetRequiredService<IRedisClient>()));
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
            services.AddSingleton(consumerConfig);

            services.AddSingleton<IMessageProducer, KafkaMessageProducer>();
            services.AddHostedService(sp =>
            {
                var cfg = sp.GetRequiredService<ConsumerConfig>();
                var logger = sp.GetRequiredService<ILogger<KafkaMessageConsumer>>();
                var provider = sp.GetRequiredService<IServiceProvider>();

                return new KafkaMessageConsumer(cfg, provider, logger, KafkaConsumerTopics.All);
            });

            // Shared with the consumer-group diagnostic health check, which registers the same
            // singleton, so the endpoint and the backlog gauge read one broker connection.
            services.TryAddSingleton<KafkaLagReader>();

            AddBacklogSampler(sp => new KafkaBacklogProbe(sp.GetRequiredService<KafkaLagReader>()));
        }

        void AddPostgres()
        {
            services.TryAddPostgres(configuration);

            services.AddSingleton<IMessageProducer, PostgresMessageProducer>();
            services.AddHostedService(sp =>
            {
                var scopeFactory = sp.GetRequiredService<IServiceScopeFactory>();
                var dataSource = sp.GetRequiredService<NpgsqlDataSource>();
                var logger = sp.GetRequiredService<ILogger<PostgresMessageConsumer>>();

                // Same list the backlog probe counts, so a topic can never be drained without
                // being watched.
                return new PostgresMessageConsumer(
                    scopeFactory, dataSource, logger, PostgresConsumerTopics.All);
            });

            AddBacklogSampler(sp => new PostgresBacklogProbe(
                sp.GetRequiredService<NpgsqlDataSource>(), PostgresConsumerTopics.All));
        }

        void AddBacklogSampler(Func<IServiceProvider, IBacklogProbe> probeFactory)
        {
            var interval = BacklogSamplerOptions.Resolve(configuration);
            if (interval is null)
            {
                // Explicitly disabled. The gauges are never registered, so they report nothing
                // rather than reporting a frozen "unknown" forever.
                return;
            }

            services.AddSingleton(probeFactory);
            services.AddHostedService(sp => new MessagingBacklogSampler(
                sp.GetServices<IBacklogProbe>(),
                sp.GetRequiredService<ILogger<MessagingBacklogSampler>>(),
                interval));
        }

        void AddMessageHandlers()
        {
            services.AddKeyedTransient<IMessageHandler, EndUserMessageHandler>(Topics.EndUser);
            services.AddKeyedTransient<IMessageHandler, InsightMessageHandler>(Topics.Insights);
            services.AddKeyedTransient<IMessageHandler, UsageMessageHandler>(Topics.Usage);
            services.AddKeyedTransient<IMessageHandler, ControlPlaneWebHooksMessageHandler>(ControlPlaneTopics.ControlPlaneWebHooks);
        }
    }
}
