using Domain.Messages;
using Domain.Shared;
using Infrastructure.Fakes;
using Infrastructure.Kafka;
using Infrastructure.MongoDb;
using Infrastructure.Redis;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace Infrastructure;

public static class ConfigureServices
{
    public static IServiceCollection AddRedisStore(this IServiceCollection services, RedisOptions options)
    {
        var redisClient = new RedisClient(options);
        services.TryAddSingleton(redisClient);
        services.AddSingleton<IStore, RedisStore>();

        return services;
    }

    public static void AddMongoDb(this IServiceCollection services, MongoDbOptions options)
    {
        var mongoDbClient = new MongoDbClient(options);
        services.TryAddSingleton(mongoDbClient);
    }

    public static void AddKafkaMessageQueue(this IServiceCollection services)
    {
        services.AddSingleton<IMessageProducer, KafkaMessageProducer>();
        services.AddHostedService<KafkaMessageConsumer>();
    }

    public static void AddRedisMessageQueue(this IServiceCollection services)
    {
        services.AddSingleton<IMessageProducer, RedisMessageProducer>();
        services.AddHostedService<RedisMessageConsumer>();
    }

    public static IServiceCollection AddFakeStore(this IServiceCollection services)
    {
        services.AddSingleton<IStore, FakeStore>();

        return services;
    }

    public static IServiceCollection AddFakeMessageQueue(this IServiceCollection services)
    {
        services.AddSingleton<IMessageProducer, FakeMessageProducer>();

        return services;
    }
}