using System.Text;

namespace Api.Authentication.OpenIdConnect;

public interface IClientAuthenticator
{
    AuthParameters GetAuthParameters(string code, OidcOptions options);
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
    public AuthParameters GetAuthParameters(string code, OidcOptions options)
    {
        var kvs = new List<KeyValuePair<string, string>>
        {
            new("code", code),
            new("grant_type", "authorization_code"),
            new("redirect_uri", options.RedirectUri)
        };
        var httpContent = new FormUrlEncodedContent(kvs);

        var client = $"{options.ClientId}:{options.ClientSecret}";
        var authorizationString = Convert.ToBase64String(Encoding.UTF8.GetBytes(client));

        var param = new AuthParameters(httpContent, authorizationString);
        return param;
    }
}

public class PostAuthenticator : IClientAuthenticator
{
    public AuthParameters GetAuthParameters(string code, OidcOptions options)
    {
        var kvs = new List<KeyValuePair<string, string>>
        {
            new("code", code),
            new("grant_type", "authorization_code"),
            new("redirect_uri", options.RedirectUri),
            new("client_id", options.ClientId),
            new("client_secret", options.ClientSecret),
        };
        var httpContent = new FormUrlEncodedContent(kvs);

        var param = new AuthParameters(httpContent, string.Empty);
        return param;
    }
}

public class NoneAuthenticator : IClientAuthenticator
{
    public AuthParameters GetAuthParameters(string code, OidcOptions options)
    {
        var kvs = new List<KeyValuePair<string, string>>
        {
            new("code", code),
            new("grant_type", "authorization_code"),
            new("redirect_uri", options.RedirectUri)
        };
        var httpContent = new FormUrlEncodedContent(kvs);

        var param = new AuthParameters(httpContent, string.Empty);
        return param;
    }
}