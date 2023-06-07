using Domain.Messages;
using Domain.Shared;
using Infrastructure.Fakes;
using Infrastructure.Kafka;
using Infrastructure.Redis;
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

    public static IStreamingBuilder UseRedisStore(this IStreamingBuilder builder, Action<RedisOptions> configureOptions)
    {
        var options = new RedisOptions();
        configureOptions(options);
        var redisClient = new RedisClient(options);

        var services = builder.Services;
        services.TryAddSingleton(redisClient);
        services.AddSingleton<IStore, RedisStore>();

        return builder;
    }
}