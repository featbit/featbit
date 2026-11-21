namespace Application.Services;

public interface IProviderCredentialProtector
{
    string Protect(string secret, string context);

    string Unprotect(string protectedCredential, string context);
}
