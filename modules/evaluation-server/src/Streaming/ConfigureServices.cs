using Domain;
using Domain.Messages;
using Microsoft.Extensions.Internal;
using Microsoft.Extensions.DependencyInjection;
using Streaming.Connections;
using Streaming.Consumers;
using Streaming.Messages;
using Streaming.Services;

namespace Streaming;

public static class ConfigureServices
{
    public static IServiceCollection AddStreamingCore(this IServiceCollection services)
    {
        // system clock
        services.AddSingleton<ISystemClock, SystemClock>();

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

        // message consumers
        services
            .AddSingleton<IMessageConsumer, FeatureFlagChangeMessageConsumer>()
            .AddSingleton<IMessageConsumer, SegmentChangeMessageConsumer>();

        return services;
    }
}