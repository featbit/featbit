using Confluent.Kafka;
using Domain.Messages;
using Infrastructure.Caches.Redis;
using Infrastructure.MQ.Kafka;
using Infrastructure.MQ.None;
using Infrastructure.MQ.Postgres;
using Infrastructure.MQ.Redis;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
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

                var topics = new[]
                {
                    Topics.EndUser, Topics.Insights, Topics.Usage, ControlPlaneTopics.ControlPlaneWebHooks
                };

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
            services.AddSingleton(consumerConfig);

            services.AddSingleton<IMessageProducer, KafkaMessageProducer>();
            services.AddHostedService(sp =>
            {
                var cfg = sp.GetRequiredService<ConsumerConfig>();
                var logger = sp.GetRequiredService<ILogger<KafkaMessageConsumer>>();
                var provider = sp.GetRequiredService<IServiceProvider>();

                var topics = new[]
                {
                    Topics.EndUser, Topics.Usage, ControlPlaneTopics.ControlPlaneWebHooks
                };

                return new KafkaMessageConsumer(cfg, provider, logger, topics);
            });
        }

        void AddPostgres()
        {
            services.TryAddPostgres(configuration);

            services.AddSingleton<IMessageProducer, PostgresMessageProducer>();
            services.AddHostedService(sp =>
            {
                var topics = new[]
                {
                    Topics.EndUser, Topics.Insights, Topics.Usage, ControlPlaneTopics.ControlPlaneWebHooks
                };

                var scopeFactory = sp.GetRequiredService<IServiceScopeFactory>();
                var dataSource = sp.GetRequiredService<NpgsqlDataSource>();
                var logger = sp.GetRequiredService<ILogger<PostgresMessageConsumer>>();

                return new PostgresMessageConsumer(scopeFactory, dataSource, logger, topics);
            });
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