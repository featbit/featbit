using Domain.Observability;
using Microsoft.Extensions.Configuration;

namespace FeatBit.Observability.AspNetCore;

/// <summary>
/// Applies observability settings from <see cref="IConfiguration"/> at the composition root.
/// </summary>
/// <remarks>
/// <para>
/// These knobs were originally environment-variable-only, which made them awkward to set for local
/// development and impossible to keep alongside the rest of a service's settings. They are now
/// ordinary configuration keys, so everything .NET already supports — <c>appsettings.json</c>,
/// <c>appsettings.{Environment}.json</c>, user secrets, command-line arguments, and
/// <c>Observability__Traces__Categories</c>-style environment variables — works without any extra
/// wiring.
/// </para>
/// <para>
/// <b>The original variables keep working.</b> Each setting falls back to its legacy
/// <c>FEATBIT_*</c> name, so an existing deployment behaves identically after this change. The
/// structured key wins when both are present.
/// </para>
/// <para>
/// Nothing is written to <c>appsettings.json</c> by default on purpose: a key present with a default
/// value would out-rank the legacy environment variable and silently override it.
/// </para>
/// </remarks>
public static class ObservabilityConfiguration
{
    /// <summary>Configuration section holding every observability setting.</summary>
    public const string SectionName = "Observability";

    /// <summary>Comma-separated trace categories, or <c>all</c>.</summary>
    public const string TraceCategoriesKey = SectionName + ":Traces:Categories";

    /// <summary>Trace sample ratio, <c>0.0</c>–<c>1.0</c>.</summary>
    public const string TraceSampleRatioKey = SectionName + ":Traces:SampleRatio";

    /// <summary>Deployment-wide HMAC salt used when hashing credentials for logs.</summary>
    public const string RedactionSaltKey = SectionName + ":RedactionSalt";

    /// <summary>
    /// Reads the observability settings and applies them to the process-wide gates.
    /// </summary>
    /// <remarks>
    /// Call this first in the composition root, before anything can create a span or redact a value.
    /// It is safe to call more than once with the same values.
    /// </remarks>
    public static void Apply(IConfiguration configuration)
    {
        ArgumentNullException.ThrowIfNull(configuration);

        ApplyTraceGate(configuration);
        Redaction.ConfigureSalt(ResolveRedactionSalt(configuration));
    }

    /// <summary>
    /// The configured HMAC salt, or <c>null</c> when neither the structured key nor the legacy
    /// variable supplies one.
    /// </summary>
    public static string? ResolveRedactionSalt(IConfiguration configuration)
    {
        ArgumentNullException.ThrowIfNull(configuration);

        return Resolve(configuration, RedactionSaltKey, Redaction.SaltVariable);
    }

    /// <summary>
    /// Builds the trace gate described by <paramref name="configuration"/>, or <c>null</c> when the
    /// configuration says nothing about tracing.
    /// </summary>
    /// <remarks>
    /// A <c>null</c> result means "leave the existing gate alone" rather than "disable tracing".
    /// <see cref="TraceGate.Current"/> is already initialized from the environment, so overwriting it
    /// with a disabled gate would silently turn off tracing for a deployment that had enabled it
    /// through the legacy variable in a host whose configuration excludes environment variables.
    /// </remarks>
    public static TraceGate? ResolveTraceGate(IConfiguration configuration)
    {
        ArgumentNullException.ThrowIfNull(configuration);

        var categories = Resolve(configuration, TraceCategoriesKey, TraceGate.CategoriesVariable);
        if (string.IsNullOrWhiteSpace(categories))
        {
            return null;
        }

        var sampleRatio = Resolve(configuration, TraceSampleRatioKey, TraceGate.SampleRatioVariable);
        return TraceGate.FromValues(categories, sampleRatio);
    }

    private static void ApplyTraceGate(IConfiguration configuration)
    {
        var gate = ResolveTraceGate(configuration);
        if (gate is not null)
        {
            TraceGate.SetCurrent(gate);
        }
    }

    private static string? Resolve(IConfiguration configuration, string key, string legacyKey)
    {
        var value = configuration[key];
        return !string.IsNullOrWhiteSpace(value) ? value : configuration[legacyKey];
    }
}
