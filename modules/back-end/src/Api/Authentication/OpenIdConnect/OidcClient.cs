using System.IdentityModel.Tokens.Jwt;
using System.Net.Http.Headers;
using System.Text.Json;
using Application.Identity;
using Domain.Workspaces;

namespace Api.Authentication.OpenIdConnect;

public class OidcClient
{
    private readonly IHttpClientFactory _httpClientFactory;

    public OidcClient(IHttpClientFactory httpClientFactory)
    {
        _httpClientFactory = httpClientFactory;
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
        var httpclient = _httpClientFactory.CreateClient();
        if (!string.IsNullOrEmpty(authParams.BasicAuthorizationString))
        {
            httpclient.DefaultRequestHeaders.Authorization =
                new AuthenticationHeaderValue("Basic", authParams.BasicAuthorizationString);
        }

        var response = await httpclient.PostAsync(config.TokenEndpoint, authParams.HttpContent);
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