using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Application.RelayProxies;
using Microsoft.Net.Http.Headers;

namespace Infrastructure.Services;

public class AgentService(HttpClient httpClient) : IAgentService
{
    public async Task<HttpStatusCode> CheckAvailabilityAsync(string host)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, $"{host}/health/liveness");
        try
        {
            var response = await httpClient.SendAsync(request);
            return response.StatusCode;
        }
        catch (HttpRequestException)
        {
            return HttpStatusCode.ServiceUnavailable;
        }
    }

    public async Task<SyncResult> BootstrapAsync(string host, string key, object payload)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, $"{host}/api/public/proxy/bootstrap")
        {
            Headers =
            {
                { HeaderNames.Authorization, key }
            },
            Content = JsonContent.Create(payload)
        };

        var response = await httpClient.SendAsync(request);
        response.EnsureSuccessStatusCode();

        var body = await response.Content.ReadAsStringAsync();

        using var json = JsonDocument.Parse(body);
        var root = json.RootElement;

        var serves = root.TryGetProperty("serves", out var servesElem)
            ? servesElem.ToString()
            : string.Empty;
        var dataVersion = root.TryGetProperty("dataVersion", out var dataVersionElem)
            ? dataVersionElem.GetInt64()
            : 0;

        return SyncResult.Ok(serves, dataVersion);
    }
}