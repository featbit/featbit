using Domain;
using Domain.Messages;
using Infrastructure;
using Infrastructure.Persistence;
using Infrastructure.Persistence.MongoDb;
using Infrastructure.Caches.Redis;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Internal;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using Streaming.Connections;
using Streaming.Consumers;
using Streaming.Messages;
using Streaming.Services;

namespace Streaming.DependencyInjection;

public static class StreamingServiceCollectionExtensions
{
    public static IStreamingBuilder AddStreamingCore(
        this IServiceCollection services,
        Action<StreamingOptions>? configureOptions = null)
    {
        // add streaming options
        var options = new StreamingOptions();
        configureOptions?.Invoke(options);
        services.AddSingleton(options);

        // system clock
        services.AddSingleton<ISystemClock, SystemClock>();

        // request validator
        services.AddSingleton<IRequestValidator, RequestValidator>();

        // services
        services
            .AddEvaluator()
            .AddTransient<IDataSyncService, DataSyncService>();

        var rpServiceType = options.CustomRpService != null
            ? options.CustomRpService.GetType()
            : typeof(RelayProxyService);

        services.AddTransient(typeof(IRelayProxyService), rpServiceType);

        // connection
        services.AddSingleton<IConnectionManager, ConnectionManager>();

        // message handlers
        services
            .AddSingleton<MessageDispatcher>()
            .AddTransient<IMessageHandler, PingMessageHandler>()
            .AddTransient<IMessageHandler, EchoMessageHandler>()
            .AddTransient<IMessageHandler, DataSyncMessageHandler>()
            .AddTransient<IMessageHandler, RpAgentStatusMessageHandler>();

        // mq message consumers
        services
            .AddSingleton<IMessageConsumer, FeatureFlagChangeMessageConsumer>()
            .AddSingleton<IMessageConsumer, SegmentChangeMessageConsumer>();

        return new StreamingBuilder(services);
    }

    public static void TryAddRedis(this IServiceCollection services, IConfiguration configuration)
    {
        if (services.Any(service => service.ServiceType == typeof(IRedisClient)))
        {
            return;
        }

        services.AddOptionsWithValidateOnStart<RedisOptions>()
            .Bind(configuration.GetSection(RedisOptions.Redis))
            .ValidateDataAnnotations();

        services.AddSingleton<IRedisClient, RedisClient>();
    }

    public static void TryAddMongoDb(this IServiceCollection services, IConfiguration configuration)
    {
        if (services.Any(service => service.ServiceType == typeof(IMongoDbClient)))
        {
            return;
        }

        services.AddOptionsWithValidateOnStart<MongoDbOptions>()
            .Bind(configuration.GetSection(MongoDbOptions.MongoDb))
            .ValidateDataAnnotations();

        services.AddSingleton<IMongoDbClient, MongoDbClient>();
    }

    public static void TryAddPostgres(this IServiceCollection services, IConfiguration configuration)
    {
        if (services.Any(service => service.ServiceType == typeof(NpgsqlDataSource)))
        {
            return;
        }

        services.AddOptionsWithValidateOnStart<PostgresOptions>()
            .Bind(configuration.GetSection(PostgresOptions.Postgres))
            .ValidateDataAnnotations();

        services.AddNpgsqlDataSource(configuration.GetPostgresConnectionString());
    }
}