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

    # Attach an exemplar - one concrete trace/span id - to metric data points, which is what lets a
    # dashboard pivot from a latency spike straight to a trace of a request that caused it. Without
    # it, metrics correlate to nothing: trace_id joins logs to spans and change_id joins across
    # async hops, but a metric would carry no pointer back to either.
    #
    # The .NET auto-instrumentation does NOT enable this by default, verified by running with and
    # without it: 0 exemplars across 215 FeatBit metric data points, against 48 of them carrying
    # one afterwards.
    #
    # trace_based, not always_on, so an exemplar is attached only where a *recorded* span is
    # actually in scope and there is something to pivot to. Note what this does and does not
    # depend on: it does NOT require FeatBit's own tracing to be switched on. With
    # Observability:Traces:Categories unset, measurements taken during a request still land inside
    # the auto-instrumentation's ASP.NET Core server span, so the pivot resolves to the HTTP
    # request - verified. Turning FeatBit categories on only makes the target finer-grained, from
    # "the PUT that did this" to "the persist stage of that PUT".
    #
    # The cost is a trace id and a span id on data points recorded inside a live span. Set this to
    # always_off to opt out.
    export OTEL_METRICS_EXEMPLAR_FILTER=${OTEL_METRICS_EXEMPLAR_FILTER:-trace_based}

    export DOTNET_STARTUP_HOOKS="$INSTALL_DIR/net/OpenTelemetry.AutoInstrumentation.StartupHook.dll"
    export CORECLR_ENABLE_PROFILING="1"
    export CORECLR_PROFILER="{918728DD-259F-4A6A-AC2B-B85E1B658318}"
    export CORECLR_PROFILER_PATH="$INSTALL_DIR/linux-x64/OpenTelemetry.AutoInstrumentation.Native.so"
fi

# Use 'exec' to replace the shell process with the application process.
# This ensures proper signal handling (e.g., SIGTERM) and graceful shutdown.
exec dotnet Api.dll
