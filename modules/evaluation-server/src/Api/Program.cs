using Api.Middlewares;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.Extensions.Internal;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.

builder.Services.AddControllers();
// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// add SystemClock
builder.Services.AddSingleton<ISystemClock, SystemClock>();

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

// enable streaming
app.UseStreaming();

app.MapControllers();

app.Run();

// https://docs.microsoft.com/en-us/aspnet/core/test/integration-tests?view=aspnetcore-6.0#basic-tests-with-the-default-webapplicationfactory
// Make the implicit Program class public so test projects can access it
public partial class Program { }