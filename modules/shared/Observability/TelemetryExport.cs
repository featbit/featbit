#nullable enable

namespace Domain.Observability;

/// <summary>
/// Whether this process is exporting telemetry, read from the same switch the container entrypoint
/// uses to install the OpenTelemetry profiler.
/// </summary>
/// <remarks>
/// <para>
/// Instrumentation itself is free enough to leave on unconditionally: an instrument with no listener
/// costs an atomic add. This switch exists for the one exception — work that runs <i>only</i> to
/// feed an instrument and imposes a cost whether or not anyone is listening. A background query
/// against production Redis, Postgres, or Kafka is exactly that, and running it for a gauge nobody
/// can read is load with no consumer.
/// </para>
/// <para>
/// Keyed on <c>ENABLE_OPENTELEMETRY</c> rather than on a separate setting so there is one answer to
/// "is telemetry on?". <c>start.sh</c> reads it to decide whether to enable the profiler, and
/// <c>ConfigureSerilog</c> reads it to decide whether to emit OTLP logs; a second, independent knob
/// would let those three disagree.
/// </para>
/// </remarks>
public static class TelemetryExport
{
    /// <summary>The environment variable that enables telemetry export for the process.</summary>
    public const string EnabledVariable = "ENABLE_OPENTELEMETRY";

    /// <summary>
    /// Whether telemetry export is enabled. Anything other than <c>true</c> — including the
    /// variable being absent — reads as disabled, matching the entrypoint's own comparison.
    /// </summary>
    public static bool IsEnabled() => IsEnabled(Environment.GetEnvironmentVariable(EnabledVariable));

    /// <summary>
    /// Whether <paramref name="value"/> enables export. Exposed so the rule can be tested without
    /// mutating process-wide environment state.
    /// </summary>
    public static bool IsEnabled(string? value)
        => string.Equals(value?.Trim(), "true", StringComparison.OrdinalIgnoreCase);
}
