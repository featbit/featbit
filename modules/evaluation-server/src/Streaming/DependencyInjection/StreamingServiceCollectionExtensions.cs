using Domain;
using Domain.Shared;
using Infrastructure.Persistence;
using Infrastructure.Persistence.MongoDb;
using Infrastructure.Redis;
using Infrastructure.Store;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Internal;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Streaming.Connections;
using Streaming.Messages;
using Streaming.Services;

namespace Streaming.DependencyInjection;

public static class StreamingServiceCollectionExtensions
{
    public static IStreamingBuilder AddStreamingCore(this IServiceCollection services)
    {
        // system clock
        services.AddSingleton<ISystemClock, SystemClock>();

        // request validator
        services.AddSingleton<IRequestValidator, RequestValidator>();

        // data-sync service
        services
            .AddEvaluator()
            .AddTransient<IDataSyncService, DataSyncService>();

        // connection
        services
            .AddSingleton<IConnectionManager, ConnectionManager>()
            .AddScoped<IConnectionHandler, ConnectionHandler>();

        // message handlers
        services
            .AddTransient<IMessageHandler, PingMessageHandler>()
            .AddTransient<IMessageHandler, EchoMessageHandler>()
            .AddTransient<IMessageHandler, DataSyncMessageHandler>();

        return new StreamingBuilder(services);
    }

    public static IServiceCollection AddRedisStore(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddOptionsWithValidateOnStart<RedisOptions>()
            .Bind(configuration.GetSection(RedisOptions.Redis))
            .ValidateDataAnnotations();

        services.TryAddSingleton<IRedisClient, RedisClient>();
        services.AddTransient<IDbStore, RedisStore>();

        return services;
    }

    public static IServiceCollection AddMongoDbStore(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddOptionsWithValidateOnStart<MongoDbOptions>()
            .Bind(configuration.GetSection(MongoDbOptions.MongoDb))
            .ValidateDataAnnotations();

        services.TryAddSingleton<IMongoDbClient, MongoDbClient>();
        services.AddTransient<IDbStore, MongoDbStore>();

        return services;
    }

    public static IServiceCollection AddPostgresStore(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddOptionsWithValidateOnStart<PostgresOptions>()
            .Bind(configuration.GetSection(PostgresOptions.Postgres))
            .ValidateDataAnnotations();

        services.AddNpgsqlDataSource(configuration["Postgres:ConnectionString"]!);
        services.AddTransient<IDbStore, PostgresStore>();

        return services;
    }
}