namespace Api.Authentication.OpenIdConnect;

public class OidcOptions
{
    public const string Oidc = "SSO:OIDC";

    public string ClientId { get; set; }

    public string ClientSecret { get; set; }

    public string RedirectUri { get; set; }

    public string TokenEndpoint { get; set; }

    public string AuthorizationEndpoint { get; set; }

    public string UserEmailClaim { get; set; }

    public string Scope { get; set; }

    public string ClientAuthenticationMethod { get; set; }

    public AuthParameters GetAuthParameters(string code)
    {
        var authenticator = ClientAuthenticator.GetAuthenticator(ClientAuthenticationMethod);
        return authenticator.GetAuthParameters(code, this);
    }
}