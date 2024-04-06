using System.IdentityModel.Tokens.Jwt;
using System.Net.Http.Headers;
using System.Text.Json;
using Application.Identity;
using Domain.OAuthProviders;
using Microsoft.AspNetCore.WebUtilities;

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

        var response = await httpclient.PostAsync(provider.AccessTokenUrl, authParams.HttpContent);
        response.EnsureSuccessStatusCode();

        if (provider.Name == "Google")
        {
            await using var stream = await response.Content.ReadAsStreamAsync();
            using var json = await JsonDocument.ParseAsync(stream);
            var idToken = json.RootElement.GetProperty("id_token").GetString()!;

            // parse idToken
            var handler = new JwtSecurityTokenHandler();
            var jwt = handler.ReadJwtToken(idToken);

            var email = jwt.Claims.FirstOrDefault(x => x.Type == "email")?.Value;
            return email;
        }

        if (provider.Name == "GitHub")
        {
            var resStr = await response.Content.ReadAsStringAsync();
            var resDict = QueryHelpers.ParseQuery(resStr);

            if (resDict.TryGetValue("access_token", out var accessToken))
            {
                httpclient.DefaultRequestHeaders.UserAgent.ParseAdd("FeatBit");
                
                httpclient.DefaultRequestHeaders.Authorization =
                    new AuthenticationHeaderValue("Bearer", accessToken);
                
                var res = await httpclient.GetAsync(provider.ProfileUrl);
                
                res.EnsureSuccessStatusCode();
                
                var tt = await res.Content.ReadAsStringAsync();
                
                await using var stream = await res.Content.ReadAsStreamAsync();
                using var json = await JsonDocument.ParseAsync(stream);
                var email = json.RootElement.EnumerateArray()
                    .FirstOrDefault(x => x.GetProperty("primary").GetBoolean())
                    .GetProperty("email").GetString()!;

                return email;
            }
        }

        return null;
    }
}