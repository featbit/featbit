# Use this file to set environment variables for OpenTelemetry .NET AutoInstrumentation
# Assuming that auto-instrumentation is installed on windows following the instructions for Powershell
# found here: https://github.com/open-telemetry/opentelemetry-dotnet-instrumentation#shell-scripts
$INSTALL_DIR = "C:\Program Files\OpenTelemetry .NET AutoInstrumentation"
$ENV:CORECLR_ENABLE_PROFILING=1
$ENV:CORECLR_PROFILER={918728DD-259F-4A6A-AC2B-B85E1B658318}
$ENV:CORECLR_PROFILER_PATH_64="$INSTALL_DIR\win-x64\OpenTelemetry.AutoInstrumentation.Native.dll"
$ENV:DOTNET_ADDITIONAL_DEPS="$INSTALL_DIR\AdditionalDeps"
$ENV:DOTNET_SHARED_STORE="$INSTALL_DIR\store"
$ENV:DOTNET_STARTUP_HOOKS="$INSTALL_DIR\net\OpenTelemetry.AutoInstrumentation.StartupHook.dll"
$ENV:OTEL_DOTNET_AUTO_HOME="$INSTALL_DIR"
$ENV:OTEL_EXPORTER_OTLP_PROTOCOL="grpc"
$ENV:OTEL_EXPORTER_OTLP_ENDPOINT="http://localhost:4317"