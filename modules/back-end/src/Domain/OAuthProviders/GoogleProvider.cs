namespace Domain.OAuthProviders;

public class GoogleProvider : OAuthProvider
{
    public override string AuthorizeUrl => $"https://accounts.google.com/o/oauth2/v2/auth?client_id={ClientId}&response_type=code&scope=profile email&state={Name}";
    public override string ProfileUrl => throw new NotImplementedException();
    public override string AccessTokenUrl => "https://oauth2.googleapis.com/token";
}