#!/bin/bash
set -e

if [ "$ENABLE_OPENTELEMETRY" = "true" ]; then
    if [ "$OTEL_TRACES_EXPORTER" = "otlp" ]; then
        export OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=${OTEL_EXPORTER_OTLP_ENDPOINT:-http://localhost:4317}
        export OTEL_EXPORTER_OTLP_TRACES_TIMEOUT=${OTEL_EXPORTER_OTLP_TIMEOUT:-10000}
        export OTEL_EXPORTER_OTLP_TRACES_PROTOCOL=${OTEL_EXPORTER_OTLP_PROTOCOL:-grpc}
        export OTEL_EXPORTER_OTLP_TRACES_INSECURE=${OTEL_EXPORTER_OTLP_INSECURE:-true}
    fi

    if [ "$OTEL_METRICS_EXPORTER" = "otlp" ]; then
        export OTEL_EXPORTER_OTLP_METRICS_ENDPOINT=${OTEL_EXPORTER_OTLP_ENDPOINT:-http://localhost:4317}
        export OTEL_EXPORTER_OTLP_METRICS_TIMEOUT=${OTEL_EXPORTER_OTLP_TIMEOUT:-10000}
        export OTEL_EXPORTER_OTLP_METRICS_PROTOCOL=${OTEL_EXPORTER_OTLP_PROTOCOL:-grpc}
        export OTEL_EXPORTER_OTLP_METRICS_INSECURE=${OTEL_EXPORTER_OTLP_INSECURE:-true}
    fi

    if [ "$OTEL_LOGS_EXPORTER" = "otlp" ]; then
        export OTEL_EXPORTER_OTLP_LOGS_ENDPOINT=${OTEL_EXPORTER_OTLP_ENDPOINT:-http://localhost:4317}
        export OTEL_EXPORTER_OTLP_LOGS_TIMEOUT=${OTEL_EXPORTER_OTLP_TIMEOUT:-10000}
        export OTEL_EXPORTER_OTLP_LOGS_PROTOCOL=${OTEL_EXPORTER_OTLP_PROTOCOL:-grpc}
        export OTEL_EXPORTER_OTLP_LOGS_INSECURE=${OTEL_EXPORTER_OTLP_INSECURE:-true}
    fi
    # FeatBit publishes its own metrics and traces on dedicated Meters and ActivitySources. The
    # .NET auto-instrumentation exports only the sources it is told about, so without the two
    # variables below every custom instrument in docs/observability/instruments.md is collected
    # in-process and then silently dropped — which is exactly what happened before this was added.
    #
    # Defaulted here rather than documented as a prerequisite: an operator pointing FeatBit at
    # their collector should not have to know FeatBit's internal source names. An explicitly set
    # value still wins, so a narrower or wider list can be supplied per deployment.
    #
    # The same list is used for all three services. A source that a given process never creates
    # simply never matches, so one shared list keeps these files identical and removes the chance
    # of a service being given the wrong one.
    FEATBIT_OTEL_SOURCES="FeatBit.Api,FeatBit.EvaluationServer,FeatBit.ControlPlane,FeatBit.EvaluationServer.Consistency,FeatBit.ControlPlane.Consistency"
    export OTEL_DOTNET_AUTO_METRICS_ADDITIONAL_SOURCES=${OTEL_DOTNET_AUTO_METRICS_ADDITIONAL_SOURCES:-$FEATBIT_OTEL_SOURCES}
    export OTEL_DOTNET_AUTO_TRACES_ADDITIONAL_SOURCES=${OTEL_DOTNET_AUTO_TRACES_ADDITIONAL_SOURCES:-$FEATBIT_OTEL_SOURCES}

    export DOTNET_STARTUP_HOOKS="$INSTALL_DIR/net/OpenTelemetry.AutoInstrumentation.StartupHook.dll"
    export CORECLR_ENABLE_PROFILING="1"
    export CORECLR_PROFILER="{918728DD-259F-4A6A-AC2B-B85E1B658318}"
    export CORECLR_PROFILER_PATH="$INSTALL_DIR/linux-x64/OpenTelemetry.AutoInstrumentation.Native.so"
fi

# Use 'exec' to replace the shell process with the application process.
# This ensures proper signal handling (e.g., SIGTERM) and graceful shutdown.
exec dotnet Api.dll
