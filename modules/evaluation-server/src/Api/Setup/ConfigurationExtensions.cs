using Api.RateLimiting;

namespace Api.Setup;

public static class ConfigurationExtensions
{
    public static bool IsRateLimitingEnabled(this IConfiguration configuration)
    {
        var isEnabled = configuration
            .GetSection(RateLimitingOptions.SectionName)
            .GetValue<string>(nameof(RateLimitingOptions.Enabled));

        return string.Equals(isEnabled, bool.TrueString, StringComparison.OrdinalIgnoreCase);
    }
}