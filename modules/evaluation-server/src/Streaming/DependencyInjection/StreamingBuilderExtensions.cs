using Confluent.Kafka;
using Domain.Messages;
using Domain.Shared;
using Infrastructure;
using Infrastructure.Caches;
using Infrastructure.Fakes;
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

        return builder;

        void AddConsumers()
        {
            services
                .AddSingleton<IMessageConsumer, FeatureFlagChangeMessageConsumer>()
                .AddSingleton<IMessageConsumer, SegmentChangeMessageConsumer>();
        }

        void AddNone()
        {
            builder.Services.AddSingleton<IMessageProducer, NoneMessageProducer>();
        }

        void AddRedis()
        {
            services.TryAddRedis(configuration);

            services.AddSingleton<IMessageProducer, RedisMessageProducer>();
            services.AddHostedService<RedisMessageConsumer>();
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
            services.AddHostedService<KafkaMessageConsumer>();
        }

        void AddPostgres()
        {
            services.TryAddPostgres(configuration);

            services.AddSingleton<IMessageProducer, PostgresMessageProducer>();
            services.AddHostedService<PostgresMessageConsumer>();
        }
    }

    public static IStreamingBuilder UseStore<TStoreType>(this IStreamingBuilder builder) where TStoreType : IStore
    {
        builder.Services.AddSingleton(typeof(IStore), typeof(TStoreType));

        return builder;
    }

    public static IStreamingBuilder UseStore(this IStreamingBuilder builder, IConfiguration configuration)
    {
        var services = builder.Services;

        var dbProvider = configuration.GetDbProvider();
        switch (dbProvider.Name)
        {
            case DbProvider.Fake:
                AddFake();
                break;
            case DbProvider.MongoDb:
                AddMongoDb();
                break;
            case DbProvider.Postgres:
                AddPostgres();
                break;
        }

        var cacheProvider = configuration.GetCacheProvider();
        switch (cacheProvider)
        {
            case CacheProvider.Redis:
                AddRedis();
                break;

            case CacheProvider.None:
                // use db store if no cache provider is specified
                services.AddSingleton<IStore>(x => x.GetRequiredService<IDbStore>());
                break;
        }

        return builder;

        void AddFake()
        {
            services.AddSingleton<IDbStore, FakeStore>();
        }

        void AddMongoDb()
        {
            services.TryAddMongoDb(configuration);
            services.AddTransient<IDbStore, MongoDbStore>();
        }

        void AddPostgres()
        {
            services.TryAddPostgres(configuration);
            services.AddTransient<IDbStore, PostgresStore>();
        }

        void AddRedis()
        {
            services.TryAddRedis(configuration);
            services.AddTransient<IDbStore, RedisStore>();

            // use hybrid store if we use Redis cache
            services.AddSingleton<IStore, HybridStore>();
            services.AddHostedService<StoreAvailableSentinel>();
        }
    }
}