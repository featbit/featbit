namespace Domain.OAuthProviders;

public class GitHubProvider: OAuthProvider
{
    public override string AuthorizeUrl => $"https://github.com/login/oauth/authorize?client_id={ClientId}&response_type=code&scope=user:email&state={Name}";
    public override string EmailUrl => "https://api.github.com/user/emails";
    public override string AccessTokenUrl => "https://github.com/login/oauth/access_token";
}