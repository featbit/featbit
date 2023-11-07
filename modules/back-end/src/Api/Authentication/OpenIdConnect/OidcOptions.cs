using Application.Identity;
using Domain.Workspaces;

namespace Api.Authentication.OpenIdConnect;

public class OidcOptions
{
    public const string Oidc = "SSO:OIDC";
    
    public OidcConfig Config { get; set; }

    public static OidcOptions FromOidcConfig(OidcConfig config)
    {
        var oidcOptions = new OidcOptions
        {
            Config = config
        };

        return oidcOptions;
    }
    
    public AuthParameters GetAuthParameters(LoginByOidcCode request)
    {
        var authenticator = ClientAuthenticator.GetAuthenticator(Config.ClientAuthenticationMethod);
        return authenticator.GetAuthParameters(request, this);
    }
}