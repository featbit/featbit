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

        var accessTokenResponse = await httpclient.PostAsync(provider.AccessTokenUrl, authParams.HttpContent);
        accessTokenResponse.EnsureSuccessStatusCode();

        switch (provider.Name)
        {
            case OAuthProviderNames.Google:
            {
                await using var stream = await accessTokenResponse.Content.ReadAsStreamAsync();
                using var json = await JsonDocument.ParseAsync(stream);
                var idToken = json.RootElement.GetProperty("id_token").GetString()!;

                // parse idToken
                var handler = new JwtSecurityTokenHandler();
                var jwt = handler.ReadJwtToken(idToken);

                var email = jwt.Claims.FirstOrDefault(x => x.Type == "email")?.Value;
                return email;
            }
            case OAuthProviderNames.GitHub:
            {
                var responseStr = await accessTokenResponse.Content.ReadAsStringAsync();
                var responseDict = QueryHelpers.ParseQuery(responseStr);

                if (responseDict.TryGetValue("access_token", out var accessToken))
                {
                    httpclient.DefaultRequestHeaders.UserAgent.ParseAdd("FeatBit");
                    httpclient.DefaultRequestHeaders.Authorization =
                        new AuthenticationHeaderValue("Bearer", accessToken);
                
                    var emailResponse = await httpclient.GetAsync(provider.EmailUrl);
                    emailResponse.EnsureSuccessStatusCode();
                
                    await using var stream = await emailResponse.Content.ReadAsStreamAsync();
                    using var json = await JsonDocument.ParseAsync(stream);
                    var email = json.RootElement.EnumerateArray()
                        .FirstOrDefault(x => x.GetProperty("primary").GetBoolean())
                        .GetProperty("email")
                        .GetString()!;

                    return email;
                }

                break;
            }
        }

        return null;
    }
}