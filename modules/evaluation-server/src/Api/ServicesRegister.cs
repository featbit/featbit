using Domain.Core;
using Domain.MessageHandlers;
using Domain.WebSockets;
using Infrastructure.Core;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Internal;

namespace Api;

public static class ServicesRegister
{
    public static WebApplicationBuilder RegisterServices(this WebApplicationBuilder builder)
    {
        builder.Services.AddControllers();

        // Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
        builder.Services.AddEndpointsApiExplorer();
        builder.Services.AddSwaggerGen();

        // health check dependencies
        builder.Services.AddHealthChecks();

        // add app services
        builder.Services.TryAddSingleton<ISystemClock, SystemClock>();
        builder.Services.AddSingleton<IConnectionManager, ConnectionManager>();
        builder.Services.AddScoped<IConnectionHandler, ConnectionHandler>();

        // message handlers
        builder.Services.AddTransient<IMessageHandler, PingMessageHandler>();
        builder.Services.AddTransient<IMessageHandler, EchoMessageHandler>();
        builder.Services.AddTransient<IMessageHandler, DataSyncMessageHandler>();

        // message producer
        builder.Services.AddSingleton<IMessageProducer, KafkaMessageProducer>();

        return builder;
    }
}