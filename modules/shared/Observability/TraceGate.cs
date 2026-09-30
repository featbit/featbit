#nullable enable

namespace Domain.Observability;

/// <summary>
/// Category switch plus sample ratio controlling whether custom spans are created.
/// </summary>
/// <remarks>
/// <para>
/// <b>Custom traces default to off.</b> Call <see cref="ShouldTrace"/> <i>before</i> creating a span
/// and before constructing any span attributes, so that a disabled category costs a dictionary
/// lookup and nothing more.
/// </para>
/// <para>
/// Configured by environment variable so it can be flipped on a running deployment without a code
/// change:
/// </para>
/// <list type="bullet">
///   <item>
///     <description>
///       <c>FEATBIT_TRACES_CATEGORIES</c> — comma-separated category names (see
///       <see cref="TraceCategories"/>), or <c>all</c> for every category. Unset or empty disables
///       all custom tracing.
///     </description>
///   </item>
///   <item>
///     <description>
///       <c>FEATBIT_TRACES_SAMPLE_RATIO</c> — <c>0.0</c> to <c>1.0</c>, default <c>1.0</c>. Applied
///       only to categories that are enabled.
///     </description>
///   </item>
/// </list>
/// <para>
/// This gate governs FeatBit's own spans only. It is deliberately separate from
/// <c>OTEL_TRACES_SAMPLER</c>, which also affects automatic HTTP and dependency traces and is
/// therefore unsuitable as a category-level switch.
/// </para>
/// </remarks>
public sealed class TraceGate
{
    /// <summary>Environment variable naming the enabled categories.</summary>
    public const string CategoriesVariable = "FEATBIT_TRACES_CATEGORIES";

    /// <summary>Environment variable carrying the sample ratio.</summary>
    public const string SampleRatioVariable = "FEATBIT_TRACES_SAMPLE_RATIO";

    /// <summary>Value of <see cref="CategoriesVariable"/> that enables every category.</summary>
    public const string AllCategories = "all";

    private readonly HashSet<string> _enabled;
    private readonly bool _all;
    private readonly double _sampleRatio;

    /// <summary>A gate with every category disabled.</summary>
    public static TraceGate Disabled { get; } = new(Array.Empty<string>(), 0d);

    /// <summary>
    /// The gate consulted by instrumentation call sites. Defaults to the environment-derived gate;
    /// replace it at startup or in tests via <see cref="SetCurrent"/>.
    /// </summary>
    public static TraceGate Current { get; private set; } = FromEnvironment();

    /// <param name="categories">Category names to enable, or <see cref="AllCategories"/>.</param>
    /// <param name="sampleRatio">Clamped to the range 0.0–1.0.</param>
    public TraceGate(IEnumerable<string> categories, double sampleRatio)
    {
        _enabled = new HashSet<string>(categories, StringComparer.OrdinalIgnoreCase);
        _all = _enabled.Contains(AllCategories);
        _sampleRatio = double.IsNaN(sampleRatio) ? 0d : Math.Clamp(sampleRatio, 0d, 1d);
    }

    /// <summary>Builds a gate from <see cref="CategoriesVariable"/> and <see cref="SampleRatioVariable"/>.</summary>
    public static TraceGate FromEnvironment()
        => FromValues(
            Environment.GetEnvironmentVariable(CategoriesVariable),
            Environment.GetEnvironmentVariable(SampleRatioVariable));

    /// <summary>Builds a gate from raw configuration values. Invalid input disables tracing.</summary>
    public static TraceGate FromValues(string? categories, string? sampleRatio)
    {
        if (string.IsNullOrWhiteSpace(categories))
        {
            return Disabled;
        }

        var names = categories.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        var ratio = 1d;
        if (!string.IsNullOrWhiteSpace(sampleRatio) &&
            double.TryParse(sampleRatio, System.Globalization.NumberStyles.Float,
                System.Globalization.CultureInfo.InvariantCulture, out var parsed))
        {
            ratio = parsed;
        }

        return new TraceGate(names, ratio);
    }

    /// <summary>Replaces <see cref="Current"/>. Intended for composition root and tests.</summary>
    public static void SetCurrent(TraceGate gate) => Current = gate ?? Disabled;

    /// <summary>Whether <paramref name="category"/> is enabled, ignoring sampling.</summary>
    public bool IsEnabled(string category) => _all || _enabled.Contains(category);

    /// <summary>
    /// Whether a span should be created for <paramref name="category"/>: the category must be
    /// enabled and must survive the sample ratio. Check this before creating a span or building
    /// attributes.
    /// </summary>
    public bool ShouldTrace(string category)
    {
        if (!IsEnabled(category))
        {
            return false;
        }

        return _sampleRatio >= 1d || (_sampleRatio > 0d && Random.Shared.NextDouble() < _sampleRatio);
    }
}
