using System.Net.Http.Headers;
using System.Net.Mime;
using System.Text;
using System.Text.Json;
using Application.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;

namespace Application.IntegrationTests;

public class TestApp : WebApplicationFactory<Program>
{
    public async Task<HttpResponseMessage> GetAsync(string uri, bool authenticated = true)
    {
        var client = CreateClient();
        if (authenticated)
        {
            AddAuthorizationHeader(client);
        }

        return await client.GetAsync(uri);
    }

    public async Task<HttpResponseMessage> PostAsync(
        string uri,
        object payload,
        bool authenticated = true)
    {
        var client = CreateClient();
        if (authenticated)
        {
            AddAuthorizationHeader(client);
        }

        var body = JsonSerializer.Serialize(payload);
        var content = new StringContent(body, Encoding.UTF8, MediaTypeNames.Application.Json);

        return await client.PostAsync(uri, content);
    }

    private void AddAuthorizationHeader(HttpClient client)
    {
        var scopeFactory = Services.GetRequiredService<IServiceScopeFactory>();
        using var scope = scopeFactory.CreateScope();

        var identityService = scope.ServiceProvider.GetRequiredService<IIdentityService>();
        var token = identityService.IssueToken(TestUser.Instance());
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue(
            JwtBearerDefaults.AuthenticationScheme, token
        );
    }
}