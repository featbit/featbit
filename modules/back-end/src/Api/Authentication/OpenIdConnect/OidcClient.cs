using System.IdentityModel.Tokens.Jwt;
using System.Net.Http.Headers;
using System.Text.Json;
using Application.Identity;

namespace Api.Authentication.OpenIdConnect;

public class OidcClient
{
    private readonly IHttpClientFactory _httpClientFactory;

    public OidcClient(IHttpClientFactory httpClientFactory)
    {
        _httpClientFactory = httpClientFactory;
    }

    public string GetAuthorizeUrl(string redirectUri, string workspaceKey, OidcOptions options)
    {
        var url = $"{options.Config.AuthorizationEndpoint}?" +
                  $"client_id={options.Config.ClientId}" +
                  $"&response_type=code" +
                  $"&scope={options.Config.Scope}" +
                  $"&redirect_uri={redirectUri}" +
                  $"&state={workspaceKey}";

        return url;
    }

    public async Task<string?> GetEmailAsync(LoginByOidcCode request, OidcOptions options)
    {
        // exchange idToken using code
        var authParams = options.GetAuthParameters(request);

        var httpclient = _httpClientFactory.CreateClient();
        if (!string.IsNullOrEmpty(authParams.BasicAuthorizationString))
        {
            httpclient.DefaultRequestHeaders.Authorization =
                new AuthenticationHeaderValue("Basic", authParams.BasicAuthorizationString);
        }

        var response = await httpclient.PostAsync(options.Config.TokenEndpoint, authParams.HttpContent);
        response.EnsureSuccessStatusCode();

        await using var stream = await response.Content.ReadAsStreamAsync();
        using var json = await JsonDocument.ParseAsync(stream);
        var idToken = json.RootElement.GetProperty("id_token").GetString()!;

        // parse idToken
        var handler = new JwtSecurityTokenHandler();
        var jwt = handler.ReadJwtToken(idToken);

        var email = jwt.Claims.FirstOrDefault(x => x.Type == options.Config.UserEmailClaim)?.Value;
        return email;
    }
}