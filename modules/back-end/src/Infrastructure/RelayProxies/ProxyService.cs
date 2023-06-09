using System.Net.Http.Headers;
using System.Net.Http.Json;
using Domain.RelayProxies;

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
        _httpClient.BaseAddress = new Uri(host);
        
        _httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue(key);

        return await _httpClient.GetFromJsonAsync<AgentStatus>("api/public/proxy/status");
    }

    public async Task SyncAsync(string host, string key, object payload)
    {
        _httpClient.BaseAddress = new Uri(host);
        
        _httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue(key);

        var response = await _httpClient.PostAsJsonAsync("api/public/proxy/bootstrap", payload);
        
        response.EnsureSuccessStatusCode();
    }
}