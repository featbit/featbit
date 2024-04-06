namespace Domain.OAuthProviders;

public class OAuthProvider
{
    public string Name { get; set; }
    public string ClientId { get; set; }
    public string ClientSecret { get; set; }

    public string GetAccessTokenUrl()
    {
        return Name switch
        {
            "Google" => "https://oauth2.googleapis.com/token",
            _ => throw new NotImplementedException()
        };
    }
}