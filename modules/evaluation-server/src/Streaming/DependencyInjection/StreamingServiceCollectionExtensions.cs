using Domain;
using Microsoft.Extensions.Internal;
using Microsoft.Extensions.DependencyInjection;
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
}