using Domain.Core;
using Domain.Services;
using Domain.WebSockets;
using Infrastructure.Caches;
using Infrastructure.Fakes;
using Infrastructure.Kafka;
using Infrastructure.MongoDb;
using Infrastructure.MqMessageHandlers;
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
        services.AddTransient<IMessageHandler, DataSyncMessageHandler>();

        // cache populating service
        services.AddHostedService<CachePopulatingHostedService>();

        // evaluation related services
        services.AddSingleton<TargetRuleMatcher>();
        services.AddSingleton<EvaluationService>();

        // for integration tests, use faked services 
        if (builder.Environment.IsEnvironment("IntegrationTests"))
        {
            services.AddTransient<ICachePopulatingService, FakeCachePopulatingService>();
            services.AddTransient<ICacheService, FakeCacheService>();
            services.AddSingleton<IMqMessageProducer, FakeMessageProducer>();
        }
        else
        {
            // mongodb (used to populating redis data)
            services.Configure<MongoDbOptions>(configuration.GetSection(MongoDbOptions.MongoDb));
            services.AddSingleton<MongoDbClient>();

            // redis
            services.AddSingleton<IConnectionMultiplexer>(
                _ => ConnectionMultiplexer.Connect(configuration["Redis:ConnectionString"])
            );
            services.AddTransient<ICachePopulatingService, RedisPopulatingService>();
            services.AddSingleton<ICacheService, RedisService>();

            // kafka message producer & consumer
            services.AddSingleton<IMqMessageProducer, KafkaMessageProducer>();
            services.AddHostedService<KafkaMessageConsumer>();

            // message handlers
            services.AddSingleton<IMqMessageHandler, FeatureFlagChangeMessageHandler>();
            services.AddSingleton<IMqMessageHandler, SegmentChangeMessageHandler>();
        }

        return builder;
    }
}