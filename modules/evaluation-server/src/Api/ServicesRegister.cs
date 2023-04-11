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

        // evaluation related services
        services.AddSingleton<TargetRuleMatcher>();
        services.AddSingleton<EvaluationService>();

        if (builder.Environment.IsEnvironment("IntegrationTests"))
        {
            // for integration tests, use faked services 
            AddFakeMessagingServices(services);
        }
        else
        {
            AddMessagingServices(services, configuration);
        }

        return builder;
    }

    private static void AddFakeMessagingServices(IServiceCollection services)
    {
        services.AddTransient<ICacheService, FakeCacheService>();
        services.AddSingleton<IMqMessageProducer, FakeMessageProducer>();
    }

    private static void AddMessagingServices(IServiceCollection services, IConfiguration configuration)
    {
        // mongodb (used to populating redis data)
        services.Configure<MongoDbOptions>(configuration.GetSection(MongoDbOptions.MongoDb));
        services.AddSingleton<MongoDbClient>();

        // redis
        services.AddSingleton<IConnectionMultiplexer>(
            _ => ConnectionMultiplexer.Connect(configuration["Redis:ConnectionString"])
        );
        services.AddSingleton<ICacheService, RedisService>();

        // message handlers
        services.AddSingleton<IMqMessageHandler, FeatureFlagChangeMessageHandler>();
        services.AddSingleton<IMqMessageHandler, SegmentChangeMessageHandler>();

        var isProVersion = configuration["IS_PRO"];
        if (isProVersion.Equals(bool.TrueString, StringComparison.OrdinalIgnoreCase))
        {
            // use kafka as message queue in pro version
            services.AddSingleton<IMqMessageProducer, KafkaMessageProducer>();
            services.AddHostedService<KafkaMessageConsumer>();
        }
        else
        {
            // use redis as message queue
            services.AddSingleton<IMqMessageProducer, RedisMessageProducer>();
            services.AddHostedService<RedisMessageConsumer>();
        }
    }
}