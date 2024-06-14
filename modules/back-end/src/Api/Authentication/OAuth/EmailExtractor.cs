using System.Text.Json;

namespace Api.Authentication.OAuth;

public static class EmailExtractor
{
    public static string Extract(string providerName, JsonDocument json)
    {
        var jsonRoot = json.RootElement;

        return providerName switch
        {
            OAuthProviders.Google => ExtractGoogle(),
            OAuthProviders.GitHub => ExtractGitHub(),
            _ => string.Empty,
        };

        string ExtractGoogle() => jsonRoot.GetProperty("email").GetString() ?? string.Empty;

        string ExtractGitHub() => jsonRoot.EnumerateArray()
            .FirstOrDefault(x => x.GetProperty("primary").GetBoolean())
            .GetProperty("email").GetString() ?? string.Empty;
    }
}