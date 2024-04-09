using Domain.Users;
using Microsoft.AspNetCore.WebUtilities;

namespace Api.Authentication.OAuth;

public class OAuthProvider
{
    public string Name { get; set; } = default!;

    public string ClientId { get; set; } = default!;

    public string ClientSecret { get; set; } = default!;

    public string AuthorizationEndpoint { get; set; } = default!;

    public string TokenEndpoint { get; set; } = default!;

    public string UserInformationEndpoint { get; set; } = default!;

    public string GetAuthorizeUrl(string redirectUri)
    {
        var scope = Name switch
        {
            OAuthProviders.Google => "profile email",
            OAuthProviders.GitHub => "user:email",
            _ => string.Empty
        };

        var parameters = new Dictionary<string, string>
        {
            { "client_id", ClientId },
            { "response_type", "code" },
            { "scope", scope },
            { "redirect_uri", redirectUri },
            { "state", Name }
        };

        return QueryHelpers.AddQueryString(AuthorizationEndpoint, parameters!);
    }

    public void PostConfigure()
    {
        switch (Name)
        {
            case OAuthProviders.Google:
                AuthorizationEndpoint = "https://accounts.google.com/o/oauth2/v2/auth";
                TokenEndpoint = "https://oauth2.googleapis.com/token";
                UserInformationEndpoint = "https://www.googleapis.com/oauth2/v3/userinfo";
                break;

            case OAuthProviders.GitHub:
                AuthorizationEndpoint = "https://github.com/login/oauth/authorize";
                TokenEndpoint = "https://github.com/login/oauth/access_token";
                UserInformationEndpoint = "https://api.github.com/user/emails";
                break;
        }
    }
}