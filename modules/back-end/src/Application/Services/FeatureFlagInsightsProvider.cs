using Microsoft.Extensions.Configuration;

namespace Application.Services;

public static class FeatureFlagInsightsProvider
{
    public const string SectionName = "FeatureFlagInsights";
    public const string Api = "featbit-api";
    public const string Das = "featbit-das";

    public static string Get(IConfiguration configuration)
    {
        var provider =
            Environment.GetEnvironmentVariable("FEATURE_FLAG_INSIGHTS_PROVIDER") ??
            configuration[$"{SectionName}:Provider"];

        if (string.IsNullOrWhiteSpace(provider))
        {
            throw new InvalidOperationException(
                "Feature flag insights provider is not configured. Set FEATURE_FLAG_INSIGHTS_PROVIDER or FeatureFlagInsights:Provider to 'featbit-api' or 'featbit-das'.");
        }

        if (string.Equals(provider, Api, StringComparison.OrdinalIgnoreCase))
        {
            return Api;
        }

        if (string.Equals(provider, Das, StringComparison.OrdinalIgnoreCase))
        {
            return Das;
        }

        throw new InvalidOperationException(
            "Invalid feature flag insights provider. Use 'featbit-api' or 'featbit-das'.");
    }

    public static bool UseApi(IConfiguration configuration) => Get(configuration) == Api;
}
