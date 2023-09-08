namespace Api.Authentication.OpenIdConnect;

public class AuthParameters
{
    public HttpContent HttpContent { get; set; }

    public string BasicAuthorizationString { get; set; }
}