namespace Api.Authentication.OpenIdConnect;

public class OidcOptions
{
    public const string Oidc = "SSO:OIDC";

    public string ClientId { get; set; } = string.Empty;

    public string ClientSecret { get; set; } = string.Empty;

    public string RedirectUri { get; set; } = string.Empty;

    public string TokenEndpoint { get; set; } = string.Empty;

    public string AuthorizationEndpoint { get; set; } = string.Empty;

    public string UserEmailClaim { get; set; } = string.Empty;

    public string Scope { get; set; } = string.Empty;

    public string ClientAuthenticationMethod { get; set; } = string.Empty;

    public AuthParameters GetAuthParameters(string code)
    {
        var authenticator = ClientAuthenticator.GetAuthenticator(ClientAuthenticationMethod);
        return authenticator.GetAuthParameters(code, this);
    }
}