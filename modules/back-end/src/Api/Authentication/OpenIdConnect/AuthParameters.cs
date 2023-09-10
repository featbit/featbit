namespace Api.Authentication.OpenIdConnect;

public class AuthParameters
{
    public AuthParameters(HttpContent httpContent, string basicAuthorizationString)
    {
        HttpContent = httpContent;
        BasicAuthorizationString = basicAuthorizationString;
    }

    public HttpContent HttpContent { get; set; }

    public string BasicAuthorizationString { get; set; }
}