namespace Application.Identity;

public class LoginBySocial
{
    public string Code { get; set; }

    public string RedirectUri { get; set; }
    
    public string ProviderName { get; set; }
}