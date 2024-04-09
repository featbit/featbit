using System.Net.Http.Headers;
using System.Text.Json;
using Application.Identity;
using Microsoft.Net.Http.Headers;

namespace Api.Authentication.OAuth;

public class OAuthClient
{
    private readonly HttpClient _httpClient;

    public OAuthClient(HttpClient httpClient)
    {
        _httpClient = httpClient;

        _httpClient.DefaultRequestHeaders.Add(HeaderNames.Accept, "application/json");
        _httpClient.DefaultRequestHeaders.Add(HeaderNames.UserAgent, "FeatBit");
    }

    public async Task<string> GetEmailAsync(LoginByOAuthCode request, OAuthProvider provider)
    {
        var accessToken = await ExchangeCodeAsync(request.Code, request.RedirectUri);

        var userInfoRequest = new HttpRequestMessage(HttpMethod.Get, provider.UserInformationEndpoint);
        userInfoRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

        using var userInfoResponse = await _httpClient.SendAsync(userInfoRequest);
        userInfoResponse.EnsureSuccessStatusCode();

        using var json = JsonDocument.Parse(await userInfoResponse.Content.ReadAsStringAsync());
        var email = EmailExtractor.Extract(request.ProviderName, json);
        return email;

        async Task<string> ExchangeCodeAsync(string code, string redirectUri)
        {
            var requestParameters = new Dictionary<string, string>
            {
                { "client_id", provider.ClientId },
                { "redirect_uri", redirectUri },
                { "client_secret", provider.ClientSecret },
                { "code", code },
                { "grant_type", "authorization_code" },
            };

            var content = new FormUrlEncodedContent(requestParameters);
            var tokenResponse = await _httpClient.PostAsync(provider.TokenEndpoint, content);
            tokenResponse.EnsureSuccessStatusCode();

            using var tokenResponseJson = JsonDocument.Parse(await tokenResponse.Content.ReadAsStringAsync());
            return tokenResponseJson.RootElement.GetProperty("access_token").GetString()!;
        }
    }
}