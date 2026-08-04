using Application.ControlPlane;
using Microsoft.Extensions.Configuration;

namespace Application;

public static class ConfigurationExtensions
{
    extension(IConfiguration configuration)
    {
        public bool IsSaasHosting()
        {
            var mode = configuration.GetSection(HostingMode.SectionName).Value ?? HostingMode.SelfHosted;

            return mode == HostingMode.SaaS;
        }

        public bool UseControlPlane() => configuration.GetValue<bool>("UseControlPlane");

        public string GetRegion() => configuration.GetSection("Region").Value ?? "local";

        /// <summary>
        /// Reads the control plane consistency mode from configuration key
        /// "ControlPlane:ConsistencyMode". Returns <see cref="ConsistencyMode.BestEffort"/>
        /// when the key is unset or cannot be parsed. Never throws.
        /// </summary>
        public ConsistencyMode GetConsistencyMode()
        {
            var value = configuration.GetSection("ControlPlane:ConsistencyMode").Value;

            return Enum.TryParse<ConsistencyMode>(value, ignoreCase: true, out var mode)
                ? mode
                : ConsistencyMode.BestEffort;
        }
    }
}