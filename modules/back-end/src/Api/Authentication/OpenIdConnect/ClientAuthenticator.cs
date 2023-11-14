using System.Text;
using Application.Identity;
using Domain.Workspaces;

namespace Api.Authentication.OpenIdConnect;

public interface IClientAuthenticator
{
    AuthParameters GetAuthParameters(LoginByOidcCode request, OidcConfig config);
}

public static class ClientAuthenticator
{
    public static IClientAuthenticator GetAuthenticator(string method)
    {
        return method switch
        {
            "client_secret_basic" => new BasicAuthenticator(),
            "client_secret_post" => new PostAuthenticator(),
            _ => new NoneAuthenticator(),
        };
    }
}

public class BasicAuthenticator : IClientAuthenticator
{
    public AuthParameters GetAuthParameters(LoginByOidcCode request, OidcConfig config)
    {
        var kvs = new List<KeyValuePair<string, string>>
        {
            new("code", request.Code),
            new("grant_type", "authorization_code"),
            new("redirect_uri", request.RedirectUri)
        };
        var httpContent = new FormUrlEncodedContent(kvs);

        var client = $"{config.ClientId}:{config.ClientSecret}";
        var authorizationString = Convert.ToBase64String(Encoding.UTF8.GetBytes(client));

        var param = new AuthParameters(httpContent, authorizationString);
        return param;
    }
}

public class PostAuthenticator : IClientAuthenticator
{
    public AuthParameters GetAuthParameters(LoginByOidcCode request, OidcConfig config)
    {
        var kvs = new List<KeyValuePair<string, string>>
        {
            new("code", request.Code),
            new("grant_type", "authorization_code"),
            new("redirect_uri", request.RedirectUri),
            new("client_id", config.ClientId),
            new("client_secret", config.ClientSecret),
        };
        var httpContent = new FormUrlEncodedContent(kvs);

        var param = new AuthParameters(httpContent, string.Empty);
        return param;
    }
}

public class NoneAuthenticator : IClientAuthenticator
{
    public AuthParameters GetAuthParameters(LoginByOidcCode request, OidcConfig config)
    {
        var kvs = new List<KeyValuePair<string, string>>
        {
            new("code", request.Code),
            new("grant_type", "authorization_code"),
            new("redirect_uri", request.RedirectUri)
        };
        var httpContent = new FormUrlEncodedContent(kvs);

        var param = new AuthParameters(httpContent, string.Empty);
        return param;
    }
}