using Serilog;
using Serilog.Settings.Configuration;
using Serilog.Sinks.OpenTelemetry;

namespace Api.Setup;

public static class ConfigureSerilog
{
    public static void Configure(LoggerConfiguration lc, IConfiguration configuration)
    {
        var readerOptions = new ConfigurationReaderOptions
        {
            SectionName = "Logging"
        };

        lc
            .ReadFrom.Configuration(configuration, readerOptions)
            .Enrich.FromLogContext()
            .Enrich.With<TraceContextEnricher>();

        // The API and control plane additionally register Serilog.Enrichers.ClientInfo's ClientIp
        // and User-Agent enrichers. That package is not referenced here, and adding a dependency
        // purely to match would be the wrong trade: the evaluation server already records the
        // caller's address as the "connection.client.ip" tag, whose emission is governed by the
        // existing TrackClientHostName setting. See docs/observability/index.md §7.

        var enableOpenTelemetry = Environment.GetEnvironmentVariable("ENABLE_OPENTELEMETRY");
        if (enableOpenTelemetry?.ToLower() == "true")
        {
            lc.WriteTo.OpenTelemetry(options =>
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

                options.ResourceAttributes = new Dictionary<string, object>
                {
                    // Honor OTEL_SERVICE_NAME so logs carry the same service.name that the .NET
                    // auto-instrumentation stamps on metrics and traces. Hardcoding it meant that
                    // renaming the service split its signals in two on the backend.
                    ["service.name"] =
                        Environment.GetEnvironmentVariable("OTEL_SERVICE_NAME") ?? "featbit-els"
                };
            });
        }
    }
}