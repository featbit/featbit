using Api.Setup;
using Serilog;
using Serilog.Events;
using Serilog.Formatting.Compact;
using Serilog.Sinks.OpenTelemetry;

try
{
    InitializeSerilog();

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

void InitializeSerilog()
{
    var configuration = new LoggerConfiguration()
        .MinimumLevel.Override("Microsoft.AspNetCore", LogEventLevel.Warning)
        .Enrich.FromLogContext()
        .WriteTo.Console(new CompactJsonFormatter());

    var enableOpenTelemetry = Environment.GetEnvironmentVariable("ENABLE_OPENTELEMETRY");
    if (enableOpenTelemetry?.ToLower() == "true")
    {
        configuration.WriteTo.OpenTelemetry(options =>
        {
            options.Endpoint =
                Environment.GetEnvironmentVariable("OTEL_EXPORTER_OTLP_ENDPOINT") ?? "http://otel-collector:4318";
            options.Protocol =
                Environment.GetEnvironmentVariable("OTEL_EXPORTER_OTLP_PROTOCOL") == "grpc"
                    ? OtlpProtocol.Grpc
                    : OtlpProtocol.HttpProtobuf;

            options.IncludedData = IncludedData.MessageTemplateTextAttribute
                                   | IncludedData.TraceIdField
                                   | IncludedData.SpanIdField;
            options.BatchingOptions.BatchSizeLimit = 2;
            options.BatchingOptions.Period = TimeSpan.FromSeconds(2);
            options.BatchingOptions.QueueLimit = 10;

            options.ResourceAttributes = new Dictionary<string, object>
            {
                ["service.name"] = "featbit-els"
            };
        });
    }

    Log.Logger = configuration.CreateLogger();
}

// https://docs.microsoft.com/en-us/aspnet/core/test/integration-tests?view=aspnetcore-6.0#basic-tests-with-the-default-webapplicationfactory
// Make the implicit Program class public so test projects can access it
public partial class Program { }