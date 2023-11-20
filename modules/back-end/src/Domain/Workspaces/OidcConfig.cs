namespace Domain.Workspaces;

public class OidcConfig
{
    public string ClientId { get; set; }

    public string ClientSecret { get; set; }

    public string TokenEndpoint { get; set; }

    public string ClientAuthenticationMethod { get; set; }

    public string AuthorizationEndpoint { get; set; }

    public string Scope { get; set; }

    public string UserEmailClaim { get; set; }
}