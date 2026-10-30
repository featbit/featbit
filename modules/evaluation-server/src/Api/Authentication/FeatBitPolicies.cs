namespace Api.Authentication;

public static class FeatBitPolicies
{
    public const string ServerSecretOnly = nameof(ServerSecretOnly);
    public const string ClientSecretOnly = nameof(ClientSecretOnly);
    public const string ServerSecretOrClientSecret = nameof(ServerSecretOrClientSecret);
}
