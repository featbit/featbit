using System.Net;
using System.Net.Http.Json;
using Microsoft.Net.Http.Headers;

namespace Infrastructure.Services;

public class AgentService(HttpClient httpClient) : IAgentService
{
    public async Task<HttpStatusCode> CheckAvailabilityAsync(string host)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, $"{host}/health/readiness");
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

        var response = await httpClient.SendAsync(request);
        response.EnsureSuccessStatusCode();
    }
}