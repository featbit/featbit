using Domain.Core;
using Domain.Services;
using Domain.WebSockets;
using Infrastructure.Caches;
using Infrastructure.Kafka;
using Infrastructure.MongoDb;
using Infrastructure.Redis;
using Infrastructure.Services;
using Infrastructure.WsMessageHandlers;
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

        // cors
        builder.Services.AddCors(options => options.AddDefaultPolicy(policyBuilder =>
        {
            policyBuilder
                .AllowAnyOrigin()
                .AllowAnyHeader()
                .AllowAnyMethod();
        }));

        // add app services
        services.TryAddSingleton<ISystemClock, SystemClock>();
        services.AddSingleton<IConnectionManager, ConnectionManager>();
        services.AddScoped<IConnectionHandler, ConnectionHandler>();
        services.AddTransient<IDataSyncService, DataSyncService>();
        services.AddSingleton<EvaluationService>();

        // websocket message handlers
        services.AddTransient<IMessageHandler, PingMessageHandler>();
        services.AddTransient<IMessageHandler, EchoMessageHandler>();

        // for integration tests, ignore below services 
        if (builder.Environment.IsEnvironment("IntegrationTests"))
        {
            return builder;
        }

        // data-sync message handler
        services.AddTransient<IMessageHandler, DataSyncMessageHandler>();

        // redis
        services.AddSingleton<IConnectionMultiplexer>(
            _ => ConnectionMultiplexer.Connect(configuration["Redis:ConnectionString"])
        );
        services.AddTransient<ICachePopulatingService, RedisPopulatingService>();
        services.AddHostedService<CachePopulatingHostedService>();
        services.AddSingleton<ICacheService, RedisService>();
        services.AddSingleton<EvaluationService>();
        services.AddSingleton<TargetRuleMatcher>();

        // mongodb
        services.Configure<MongoDbOptions>(configuration.GetSection(MongoDbOptions.MongoDb));
        services.AddSingleton<MongoDbClient>();

        // kafka message producer & consumer
        services.AddSingleton<IMessageProducer, KafkaMessageProducer>();
        services.AddHostedService<KafkaMessageConsumer>();

        // kafka message handlers
        services.AddSingleton<IKafkaMessageHandler, FeatureFlagChangeMessageHandler>();
        services.AddSingleton<IKafkaMessageHandler, SegmentChangeMessageHandler>();

        return builder;
    }
}