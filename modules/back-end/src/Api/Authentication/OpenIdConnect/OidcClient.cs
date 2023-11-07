using System.IdentityModel.Tokens.Jwt;
using System.Net.Http.Headers;
using System.Text.Json;
using System.Web;
using Application.Identity;
using Microsoft.Extensions.Options;

namespace Api.Authentication.OpenIdConnect;

public class OidcClient
{
    private readonly OidcOptions _options;
    private readonly IHttpClientFactory _httpClientFactory;

    public OidcClient(IOptions<OidcOptions> options, IHttpClientFactory httpClientFactory)
    {
        _httpClientFactory = httpClientFactory;
        _options = options.Value;
    }

    public string GetAuthorizeUrl(string redirectUri, string workspaceKey)
    {
        var url = $"{_options.AuthorizationEndpoint}?" +
                  $"client_id={_options.ClientId}" +
                  $"&response_type=code" +
                  $"&scope={_options.Scope}" +
                  $"&redirect_uri={redirectUri}" +
                  $"&state={workspaceKey}";

        return url;
    }

    public async Task<string?> GetEmailAsync(LoginByOidcCode request)
    {
        // exchange idToken using code
        var authParams = _options.GetAuthParameters(request);

        var httpclient = _httpClientFactory.CreateClient();
        if (!string.IsNullOrEmpty(authParams.BasicAuthorizationString))
        {
            httpclient.DefaultRequestHeaders.Authorization =
                new AuthenticationHeaderValue("Basic", authParams.BasicAuthorizationString);
        }

        var response = await httpclient.PostAsync(_options.TokenEndpoint, authParams.HttpContent);
        response.EnsureSuccessStatusCode();

        await using var stream = await response.Content.ReadAsStreamAsync();
        using var json = await JsonDocument.ParseAsync(stream);
        var idToken = json.RootElement.GetProperty("id_token").GetString()!;

        // parse idToken
        var handler = new JwtSecurityTokenHandler();
        var jwt = handler.ReadJwtToken(idToken);

        var email = jwt.Claims.FirstOrDefault(x => x.Type == _options.UserEmailClaim)?.Value;
        return email;
    }
}