using Domain.Messages;
using Domain.Shared;
using Infrastructure;
using Infrastructure.Kafka;
using Infrastructure.Persistence;
using Infrastructure.Redis;
using Infrastructure.Store;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Streaming.Consumers;

namespace Streaming.DependencyInjection;

public static class StreamingBuilderExtensions
{
    public static IStreamingBuilder UseNullMessageQueue(this IStreamingBuilder builder)
    {
        builder.Services.AddSingleton<IMessageProducer, NullMessageProducer>();

        return builder;
    }

    public static IStreamingBuilder UseRedisMessageQueue(this IStreamingBuilder builder)
    {
        var services = builder.Services;

        services.AddSingleton<IMessageProducer, RedisMessageProducer>();
        services.AddHostedService<RedisMessageConsumer>();

        services
            .AddSingleton<IMessageConsumer, FeatureFlagChangeMessageConsumer>()
            .AddSingleton<IMessageConsumer, SegmentChangeMessageConsumer>();

        return builder;
    }

    public static IStreamingBuilder UseKafkaMessageQueue(this IStreamingBuilder builder)
    {
        var services = builder.Services;

        services.AddSingleton<IMessageProducer, KafkaMessageProducer>();
        services.AddHostedService<KafkaMessageConsumer>();

        services
            .AddSingleton<IMessageConsumer, FeatureFlagChangeMessageConsumer>()
            .AddSingleton<IMessageConsumer, SegmentChangeMessageConsumer>();

        return builder;
    }

    public static IStreamingBuilder UseStore<TStoreType>(this IStreamingBuilder builder) where TStoreType : IStore
    {
        builder.Services.AddSingleton(typeof(IStore), typeof(TStoreType));

        return builder;
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