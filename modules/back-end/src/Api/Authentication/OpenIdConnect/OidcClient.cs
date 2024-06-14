using System.IdentityModel.Tokens.Jwt;
using System.Net.Http.Headers;
using System.Text.Json;
using Application.Identity;
using Domain.Workspaces;

namespace Api.Authentication.OpenIdConnect;

public class OidcClient
{
    private readonly HttpClient _httpClient;

    public OidcClient(HttpClient httpClient)
    {
        _httpClient = httpClient;
    }

    public string GetAuthorizeUrl(string redirectUri, string workspaceKey, OidcConfig config)
    {
        var url = $"{config.AuthorizationEndpoint}?" +
                  $"client_id={config.ClientId}" +
                  $"&response_type=code" +
                  $"&scope={config.Scope}" +
                  $"&redirect_uri={redirectUri}" +
                  $"&state={workspaceKey}";

        return url;
    }

    public async Task<string?> GetEmailAsync(LoginByOidcCode request, OidcConfig config)
    {
        // get auth parameters
        var authenticator = ClientAuthenticator.GetAuthenticator(config.ClientAuthenticationMethod);
        var authParams = authenticator.GetAuthParameters(request, config);

        // exchange idToken using code
        if (!string.IsNullOrEmpty(authParams.BasicAuthorizationString))
        {
            _httpClient.DefaultRequestHeaders.Authorization =
                new AuthenticationHeaderValue("Basic", authParams.BasicAuthorizationString);
        }

        var response = await _httpClient.PostAsync(config.TokenEndpoint, authParams.HttpContent);
        response.EnsureSuccessStatusCode();

        await using var stream = await response.Content.ReadAsStreamAsync();
        using var json = await JsonDocument.ParseAsync(stream);
        var idToken = json.RootElement.GetProperty("id_token").GetString()!;

        // parse idToken
        var handler = new JwtSecurityTokenHandler();
        var jwt = handler.ReadJwtToken(idToken);

        var email = jwt.Claims.FirstOrDefault(x => x.Type == config.UserEmailClaim)?.Value;
        return email;
    }
}