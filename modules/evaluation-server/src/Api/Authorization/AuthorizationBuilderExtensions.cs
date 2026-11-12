using Api.Authentication;
using Domain.Secrets;
using Microsoft.AspNetCore.Authorization;

namespace Api.Authorization;

public static class AuthorizationBuilderExtensions
{
    public static AuthorizationBuilder AddSecretPolicies(this AuthorizationBuilder builder)
    {
        return builder
            .AddPolicy(SecretPolicies.ServerOnly, policy => policy
                .RequireAuthenticatedUser()
                .RequireClaim(SecretClaims.SecretType, SecretTypes.Server))
            .AddPolicy(SecretPolicies.ClientOnly, policy => policy
                .RequireAuthenticatedUser()
                .RequireClaim(SecretClaims.SecretType, SecretTypes.Client))
            .AddPolicy(SecretPolicies.ServerOrClient, policy => policy
                .RequireAuthenticatedUser()
                .RequireClaim(SecretClaims.SecretType, SecretTypes.Client, SecretTypes.Server));
    }
}
