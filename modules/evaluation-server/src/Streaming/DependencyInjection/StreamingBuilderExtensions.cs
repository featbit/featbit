using Confluent.Kafka;
using Domain.Messages;
using Domain.Shared;
using Infrastructure;
using Infrastructure.MQ;
using Infrastructure.MQ.Kafka;
using Infrastructure.MQ.Postgres;
using Infrastructure.MQ.Redis;
using Infrastructure.Persistence;
using Infrastructure.Store;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Streaming.Consumers;

namespace Streaming.DependencyInjection;

public static class StreamingBuilderExtensions
{
    public static IStreamingBuilder UseStore<TStoreType>(this IStreamingBuilder builder) where TStoreType : IStore
    {
        builder.Services.AddSingleton(typeof(IStore), typeof(TStoreType));

        return builder;
    }

    public static IStreamingBuilder UseMq(this IStreamingBuilder builder, IConfiguration configuration)
    {
        var services = builder.Services;

        var mqProvider = configuration.GetMqProvider();
        if (mqProvider != MqProvider.None)
        {
            AddConsumers();
        }

        switch (mqProvider)
        {
            case MqProvider.None:
                AddNullMq();
                break;
            case MqProvider.Redis:
                AddRedisMq();
                break;
            case MqProvider.Kafka:
                AddKafkaMq();
                break;
            case MqProvider.Postgres:
                AddPostgresMq();
                break;
        }

        return builder;

        void AddConsumers()
        {
            services
                .AddSingleton<IMessageConsumer, FeatureFlagChangeMessageConsumer>()
                .AddSingleton<IMessageConsumer, SegmentChangeMessageConsumer>();
        }

        void AddNullMq()
        {
            builder.Services.AddSingleton<IMessageProducer, NullMessageProducer>();
        }

        void AddRedisMq()
        {
            services.AddSingleton<IMessageProducer, RedisMessageProducer>();
            services.AddHostedService<RedisMessageConsumer>();
        }

        void AddKafkaMq()
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
            services.AddHostedService<KafkaMessageConsumer>();
        }

        void AddPostgresMq()
        {
            services.AddSingleton<IMessageProducer, PostgresMessageProducer>();
            services.AddHostedService<PostgresMessageConsumer>();
        }
    }

    public static IStreamingBuilder UseHybridStore(this IStreamingBuilder builder, IConfiguration configuration)
    {
        var services = builder.Services;

        var dbProvider = configuration.GetDbProvider();
        if (dbProvider.Name == DbProvider.MongoDb)
        {
            services.AddMongoDbStore(configuration);
        }
        else
        {
            services.AddPostgresStore(configuration);
        }

        // redis store is always used
        services.AddRedisStore(configuration);

        services.AddSingleton<IStore, HybridStore>();
        services.AddHostedService<StoreAvailableSentinel>();

        return builder;
    }
}