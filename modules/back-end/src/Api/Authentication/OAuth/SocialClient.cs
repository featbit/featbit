using System.IdentityModel.Tokens.Jwt;
using System.Text.Json;
using Application.Identity;
using Domain.OAuthProviders;

namespace Api.Authentication.OAuth;

public class SocialClient
{
    private readonly IHttpClientFactory _httpClientFactory;

    public SocialClient(IHttpClientFactory httpClientFactory)
    {
        _httpClientFactory = httpClientFactory;
    }

    public async Task<string?> GetEmailAsync(LoginBySocial request, OAuthProvider provider)
    {
        // get auth parameters
        var authenticator = ClientAuthenticator.GetAuthenticator();
        var authParams = authenticator.GetAuthParameters(request, provider);

        // exchange access token using code
        var httpclient = _httpClientFactory.CreateClient();

        var response = await httpclient.PostAsync(provider.GetAccessTokenUrl(), authParams.HttpContent);
        response.EnsureSuccessStatusCode();

        await using var stream = await response.Content.ReadAsStreamAsync();
        using var json = await JsonDocument.ParseAsync(stream);
        var idToken = json.RootElement.GetProperty("id_token").GetString()!;

        // parse idToken
        var handler = new JwtSecurityTokenHandler();
        var jwt = handler.ReadJwtToken(idToken);

        var email = jwt.Claims.FirstOrDefault(x => x.Type == "email")?.Value;
        return email;
    }
}