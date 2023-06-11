using Domain.RelayProxies;
using System.Net.Http.Json;
using Microsoft.Net.Http.Headers;

namespace Infrastructure.RelayProxies;

public class AgentService : IAgentService
{
    private readonly HttpClient _httpClient;

    public AgentService(HttpClient httpClient)
    {
        _httpClient = httpClient;
    }

    public async Task<AgentStatus?> GetStatusAsync(string host, string key)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, $"{host}/api/public/proxy/status")
        {
            Headers =
            {
                { HeaderNames.Authorization, key }
            }
        };

        var response = await _httpClient.SendAsync(request);
        response.EnsureSuccessStatusCode();

        var status = await response.Content.ReadFromJsonAsync<AgentStatus>();
        return status;
    }

    public async Task BootstrapAsync(string host, string key, object payload)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, $"{host}/api/public/proxy/bootstrap")
        {
            Headers =
            {
                { HeaderNames.Authorization, key }
            },
            Content = JsonContent.Create(payload)
        };

        var response = await _httpClient.SendAsync(request);
        response.EnsureSuccessStatusCode();
    }
}