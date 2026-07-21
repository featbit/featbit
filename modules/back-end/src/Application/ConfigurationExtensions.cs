using Application.ControlPlane;
using Microsoft.Extensions.Configuration;

namespace Application;

public static class ConfigurationExtensions
{
    public static bool IsSaasHosting(this IConfiguration configuration)
    {
        var mode = configuration.GetSection(HostingMode.SectionName).Value ?? HostingMode.SelfHosted;

        return mode == HostingMode.SaaS;
    }
    
    public static bool UseControlPlane(this IConfiguration configuration)
    {
        return configuration.GetValue<bool>("UseControlPlane");
    }

    public static string GetRegion(this IConfiguration configuration)
    {
        return configuration.GetValue<string>("Region");
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