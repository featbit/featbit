namespace Application.Identity;

public class LoginByOidcCode
{
    public string Code { get; set; }

    public string RedirectUri { get; set; }

    public string WorkspaceKey { get; set; }
}