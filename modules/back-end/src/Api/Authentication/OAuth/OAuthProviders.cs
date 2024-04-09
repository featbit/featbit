using System.Collections;

namespace Api.Authentication.OAuth;

public class OAuthProviders : IEnumerable<OAuthProvider>
{
    public const string Google = "Google";
    public const string GitHub = "GitHub";

    private readonly ICollection<OAuthProvider> _providers;

    public OAuthProviders(IConfiguration configuration)
    {
        var providers = configuration
            .GetSection("OAuthProviders")
            .Get<OAuthProvider[]>() ?? Array.Empty<OAuthProvider>();

        foreach (var provider in providers)
        {
            provider.PostConfigure();
        }

        _providers = providers;
    }

    public OAuthProvider? GetProvider(string name)
    {
        return _providers.FirstOrDefault(x => x.Name == name);
    }

    public IEnumerator<OAuthProvider> GetEnumerator()
    {
        return _providers.GetEnumerator();
    }

    IEnumerator IEnumerable.GetEnumerator()
    {
        return GetEnumerator();
    }
}