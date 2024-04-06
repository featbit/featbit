using Application.Identity;
using Domain.OAuthProviders;

namespace Api.Authentication.OAuth;

public interface IClientAuthenticator
{
    AuthParameters GetAuthParameters(LoginBySocial request, OAuthProvider provider);
}

public static class ClientAuthenticator
{
    public static IClientAuthenticator GetAuthenticator()
    {
        return new Authenticator();
    }
}

public class Authenticator : IClientAuthenticator
{
    public AuthParameters GetAuthParameters(LoginBySocial request, OAuthProvider provider)
    {
        var kvs = new List<KeyValuePair<string, string>>
        {
            new("code", request.Code),
            new("grant_type", "authorization_code"),
            new("redirect_uri", request.RedirectUri),
            new("client_id", provider.ClientId),
            new("client_secret", provider.ClientSecret)
        };
        var httpContent = new FormUrlEncodedContent(kvs);

        var param = new AuthParameters(httpContent, string.Empty);
        return param;
    }
}