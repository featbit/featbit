using Domain.Observability;

namespace FeatBit.Observability.Tests;

/// <summary>
/// The telemetry export switch.
/// </summary>
/// <remarks>
/// This gates work that costs something whether or not anyone is listening — the backlog sampler's
/// periodic query against a production datastore. The property that matters is that it is
/// <b>closed by default</b>: an absent or malformed variable must not start polling a broker in a
/// deployment that never asked for telemetry.
/// </remarks>
public class TelemetryExportTests
{
    [Theory]
    [InlineData("true")]
    [InlineData("True")]
    [InlineData("TRUE")]
    [InlineData(" true ")]
    public void IsEnabled_WithTrue_IsEnabled(string value)
    {
        Assert.True(TelemetryExport.IsEnabled(value));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("false")]
    [InlineData("1")]
    [InlineData("yes")]
    [InlineData("enabled")]
    public void IsEnabled_WithAnythingElse_IsDisabled(string? value)
    {
        // Deliberately strict, and deliberately matching the entrypoint's own comparison: start.sh
        // tests for the literal string "true", so "1" enabling the sampler here while leaving the
        // profiler off would be the worst of both worlds — the cost with none of the signal.
        Assert.False(TelemetryExport.IsEnabled(value));
    }

    [Fact]
    public void EnabledVariable_IsTheSameSwitchTheEntrypointReads()
    {
        // A second, independent knob would let the profiler, the log exporter, and the sampler
        // disagree about whether telemetry is on.
        Assert.Equal("ENABLE_OPENTELEMETRY", TelemetryExport.EnabledVariable);
    }
}
