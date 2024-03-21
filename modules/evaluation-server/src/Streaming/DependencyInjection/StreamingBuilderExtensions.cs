using Domain.Messages;
using Domain.Shared;
using Infrastructure.Kafka;
using Infrastructure.MongoDb;
using Infrastructure.Redis;
using Infrastructure.Store;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
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

    public static IStreamingBuilder UseRedisStore(this IStreamingBuilder builder, ConfigurationManager configuration)
    {
        var services = builder.Services;

        services.Configure<RedisOptions>(configuration.GetSection(RedisOptions.Redis));
        services.TryAddSingleton<IRedisClient, RedisClient>();
        services.AddSingleton<IStore, RedisStore>();

        return builder;
    }

    public static IStreamingBuilder UseMongoDbStore(this IStreamingBuilder builder, ConfigurationManager configuration)
    {
        var services = builder.Services;

        services.Configure<MongoDbOptions>(configuration.GetSection(MongoDbOptions.MongoDb));
        services.TryAddSingleton<IMongoDbClient, MongoDbClient>();
        services.AddSingleton<IStore, MongoDbStore>();

        return builder;
    }

    public static IStreamingBuilder UseHybridStore(this IStreamingBuilder builder, ConfigurationManager configuration)
    {
        var services = builder.Services;

        services.Configure<MongoDbOptions>(configuration.GetSection(MongoDbOptions.MongoDb));
        services.Configure<RedisOptions>(configuration.GetSection(RedisOptions.Redis));

        services.TryAddSingleton<IRedisClient, RedisClient>();
        services.TryAddSingleton<IMongoDbClient, MongoDbClient>();
        services.AddSingleton<IStore, HybridStore>();
        services.AddHostedService<StoreAvailableSentinel>();

        return builder;
    }
}