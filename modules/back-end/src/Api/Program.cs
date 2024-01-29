using Api.Setup;
using Serilog;
using Serilog.Events;
using Serilog.Formatting.Compact;
using Serilog.Sinks.OpenTelemetry;

try
{
    var otel_exporter = Environment.GetEnvironmentVariable("OTEL_EXPORTER_OTLP_ENDPOINT_GRPC") ?? "http://otel-collector:4317";
    Log.Logger = new LoggerConfiguration()
        .MinimumLevel.Override("Microsoft.AspNetCore", LogEventLevel.Warning)
        .Enrich.FromLogContext()
        .Enrich.WithClientIp("X-Forwarded-For")
        .Enrich.WithRequestHeader("User-Agent")
        .WriteTo.Console(new CompactJsonFormatter())
        .WriteTo.OpenTelemetry(options =>
        {
            options.Endpoint = otel_exporter;

            options.IncludedData = IncludedData.MessageTemplateTextAttribute
                                   | IncludedData.TraceIdField
                                   | IncludedData.SpanIdField;
            options.BatchingOptions.BatchSizeLimit = 2;
            options.BatchingOptions.Period = TimeSpan.FromSeconds(2);
            options.BatchingOptions.QueueLimit = 10;

            options.ResourceAttributes = new Dictionary<string, object>
            {
                ["service.name"] = "featbit-api"
            };
        })
        .CreateLogger();

    WebApplication.CreateBuilder(args)
        .ConfigureHost()
        .RegisterServices()
        .Build()
        .SetupMiddleware()
        .Run();
}
catch (Exception ex)
{
    Log.Fatal(ex, "Application terminated unexpectedly");
}
finally
{
    Log.CloseAndFlush();
}

// https://docs.microsoft.com/en-us/aspnet/core/test/integration-tests?view=aspnetcore-6.0#basic-tests-with-the-default-webapplicationfactory
// Make the implicit Program class public so test projects can access it
public partial class Program { }