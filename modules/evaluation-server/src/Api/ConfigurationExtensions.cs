namespace Api;

/// <summary>
/// Controls how the control plane propagates changes across data centers.
/// </summary>
public enum ConsistencyMode
{
    /// <summary>
    /// Today's behavior: changes are propagated without cross-DC gating (fire-and-forget).
    /// </summary>
    BestEffort,

    /// <summary>
    /// Changes are gated on cross-DC commit before being applied. Opt-in per deployment.
    /// </summary>
    GatedCommit
}

public static class ConfigurationExtensions
{
    public static bool UseControlPlane(this IConfiguration configuration)
    {
        return configuration.GetValue<bool>("ControlPlane:Enabled");
    }

    public static int GetHeartbeatIntervalSeconds(this IConfiguration configuration)
    {
        return configuration.GetValue<int>("ControlPlane:HeartbeatIntervalSeconds");
    }

    /// <summary>
    /// Reads the data center identifier for this pod from configuration key
    /// "ControlPlane:DcId" (env-var fallback "ControlPlane__DcId" is handled by the
    /// standard configuration provider). Returns null when unset or empty.
    /// </summary>
    public static string? GetDcId(this IConfiguration configuration)
    {
        var value = configuration.GetValue<string>("ControlPlane:DcId");
        return string.IsNullOrWhiteSpace(value) ? null : value;
    }

    /// <summary>
    /// Reads the region for this pod from configuration key "ControlPlane:Region"
    /// (env-var fallback "ControlPlane__Region" is handled by the standard configuration
    /// provider). Returns null when unset or empty.
    /// </summary>
    public static string? GetRegion(this IConfiguration configuration)
    {
        var value = configuration.GetValue<string>("ControlPlane:Region");
        return string.IsNullOrWhiteSpace(value) ? null : value;
    }

    /// <summary>
    /// Reads the control plane consistency mode from configuration key
    /// "ControlPlane:ConsistencyMode". Returns <see cref="ConsistencyMode.BestEffort"/>
    /// when the key is unset or cannot be parsed. Never throws.
    /// </summary>
    public static ConsistencyMode GetConsistencyMode(this IConfiguration configuration)
    {
        var value = configuration.GetValue<string>("ControlPlane:ConsistencyMode");

        if (Enum.TryParse<ConsistencyMode>(value, ignoreCase: true, out var mode))
        {
            return mode;
        }

        return ConsistencyMode.BestEffort;
    }
}