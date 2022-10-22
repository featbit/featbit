using Domain.Core;
using Domain.MessageHandlers;
using Domain.WebSockets;
using Infrastructure.Caches;
using Infrastructure.Kafka;
using Infrastructure.MongoDb;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Internal;
using StackExchange.Redis;

namespace Api;

public static class ServicesRegister
{
    public static WebApplicationBuilder RegisterServices(this WebApplicationBuilder builder)
    {
        var services = builder.Services;
        var configuration = builder.Configuration;

        services.AddControllers();

        // Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
        services.AddEndpointsApiExplorer();
        services.AddSwaggerGen();

        // health check dependencies
        services.AddHealthChecks();

        // add app services
        services.TryAddSingleton<ISystemClock, SystemClock>();
        services.AddSingleton<IConnectionManager, ConnectionManager>();
        services.AddScoped<IConnectionHandler, ConnectionHandler>();

        // message handlers
        services.AddTransient<IMessageHandler, PingMessageHandler>();
        services.AddTransient<IMessageHandler, EchoMessageHandler>();
        services.AddTransient<IMessageHandler, DataSyncMessageHandler>();

        // message producer
        services.AddSingleton<IMessageProducer, KafkaMessageProducer>();

        // for integration tests, ignore below configs 
        if (builder.Environment.IsEnvironment("IntegrationTests"))
        {
            return builder;
        }

        // population redis
        services.AddSingleton<IConnectionMultiplexer>(
            _ => ConnectionMultiplexer.Connect(configuration["Redis:ConnectionString"])
        );
        services.AddTransient<IPopulatingService, RedisPopulatingService>();
        services.AddHostedService<RedisPopulatingHostedService>();

        // mongodb
        services.Configure<MongoDbOptions>(configuration.GetSection(MongoDbOptions.MongoDb));
        services.AddSingleton<MongoDbClient>();

        return builder;
    }
}