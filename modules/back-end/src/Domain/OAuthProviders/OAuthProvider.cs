namespace Domain.OAuthProviders;

public class OAuthProvider
{
    public string Name { get; set; }
    public string ClientId { get; set; }
    public string ClientSecret { get; set; }

    public virtual string AccessTokenUrl { get; }

    public virtual string ProfileUrl { get; }

    public virtual string AuthorizeUrl { get; }
    

    public OAuthProvider GetProvider()
    {
        return Name switch
        {
            "Google" => new GoogleProvider { Name = Name, ClientId = ClientId, ClientSecret = ClientSecret },
            "GitHub" => new GitHubProvider { Name = Name, ClientId = ClientId, ClientSecret = ClientSecret },
            _ => throw new NotImplementedException()
        };
    }
}