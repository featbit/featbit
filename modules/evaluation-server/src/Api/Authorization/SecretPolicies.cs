namespace Api.Authorization;

public static class SecretPolicies
{
    public const string ServerOnly = nameof(ServerOnly);
    public const string ClientOnly = nameof(ClientOnly);
    public const string ServerOrClient = nameof(ServerOrClient);
}
