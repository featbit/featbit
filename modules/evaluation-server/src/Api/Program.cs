using System.Net.WebSockets;
using System.Text;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.

builder.Services.AddControllers();
// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// health check dependencies
builder.Services.AddHealthChecks();

// configure HTTP request pipeline.

var app = builder.Build();

// reference: https://andrewlock.net/deploying-asp-net-core-applications-to-kubernetes-part-6-adding-health-checks-with-liveness-readiness-and-startup-probes/
// health check endpoints
// external use
app.MapHealthChecks("health/liveness", new HealthCheckOptions { Predicate = _ => false });

// enable swagger in dev mode
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// use web socket server
app.UseWebSockets();
app.Use(async (context, next) =>
{
    if (context.Request.Path == "/streaming" && context.WebSockets.IsWebSocketRequest)
    {
        // the simplest websocket server
        using var ws = await context.WebSockets.AcceptWebSocketAsync();
        
        // send message to client
        await ws.SendAsync(
            Encoding.UTF8.GetBytes("hello, client!"),
            WebSocketMessageType.Text,
            true,
            CancellationToken.None
        );

        // websocket will be close after 1s
        await Task.Delay(1000);
        
        return;
    }

    await next();
});

app.MapControllers();

app.Run();

// https://docs.microsoft.com/en-us/aspnet/core/test/integration-tests?view=aspnetcore-6.0#basic-tests-with-the-default-webapplicationfactory
// Make the implicit Program class public so test projects can access it
public partial class Program { }