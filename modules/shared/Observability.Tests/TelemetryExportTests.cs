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
    [Fact]
    public void IsEnabled_WithTheExactValue_IsEnabled()
    {
        Assert.True(TelemetryExport.IsEnabled("true"));
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
        Assert.False(TelemetryExport.IsEnabled(value));
    }

    [Theory]
    [InlineData("True")]
    [InlineData("TRUE")]
    [InlineData(" true ")]
    [InlineData("true ")]
    public void IsEnabled_WithASpellingTheEntrypointRejects_IsDisabled(string value)
    {
        // start.sh gates the profiler on [ "$ENABLE_OPENTELEMETRY" = "true" ] — exact, ordinal, and
        // untrimmed. Accepting a spelling it rejects would start the sampler's periodic datastore
        // query in a process that exports nothing: the cost with none of the signal. The gate that
        // spends money must never be the more permissive one.
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
