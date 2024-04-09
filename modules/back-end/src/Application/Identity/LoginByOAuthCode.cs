namespace Application.Identity;

public class LoginByOAuthCode
{
    public string Code { get; set; }

    public string RedirectUri { get; set; }

    public string ProviderName { get; set; }
}