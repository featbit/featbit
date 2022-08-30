using Microsoft.AspNetCore.Diagnostics.HealthChecks;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.

builder.Services.AddControllers();
// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// health check dependencies
builder.Services.AddHealthChecks();

var app = builder.Build();

// reference: https://andrewlock.net/deploying-asp-net-core-applications-to-kubernetes-part-6-adding-health-checks-with-liveness-readiness-and-startup-probes/
// health check endpoints
// external use
app.MapHealthChecks("health/liveness", new HealthCheckOptions { Predicate = _ => false });

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

app.UseAuthorization();

app.MapControllers();

app.Run();

// https://docs.microsoft.com/en-us/aspnet/core/test/integration-tests?view=aspnetcore-6.0#basic-tests-with-the-default-webapplicationfactory
// Make the implicit Program class public so test projects can access it
public partial class Program { }