namespace Api.RateLimiting;

public static class RateLimitingPolicies
{
    public const string Agent = nameof(Agent);

    public const string FeatureFlag = nameof(FeatureFlag);

    public const string Insight = nameof(Insight);

    public const string Sdk = nameof(Sdk);

    public const string Streaming = nameof(Streaming);

    public static readonly string[] ControllerPolicies = [Agent, FeatureFlag, Insight, Sdk];
}