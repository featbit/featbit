using Domain.WebSockets;
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
        builder.Services.AddSingleton<ConnectionManager>();
        builder.Services.AddScoped<ConnectionHandler>();

        return builder;
    }
}