using System.Net.WebSockets;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Internal;

namespace Application.IntegrationTests;

public class TestApp : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("IntegrationTests");

        base.ConfigureWebHost(builder);
    }

    public async Task<WebSocket> ConnectAsync(long timestamp = 0, string queryString = "")
    {
        var streamingApp = WithWebHostBuilder(builder =>
        {
            builder.ConfigureTestServices(collection =>
            {
                collection.Replace(ServiceDescriptor.Singleton<ISystemClock>(new TestClock(timestamp)));
            });
        });

        var client = streamingApp.Server.CreateWebSocketClient();
        var streamingUri = new Uri($"http://localhost/streaming{queryString}");

        var ws = await client.ConnectAsync(streamingUri, CancellationToken.None);
        return ws;
    }

    public async Task<WebSocket> ConnectWithTokenAsync(string type = "client")
    {
        const string token = "QWSBHgpnOV3wI3kKAO9q9viC0wQWQQBDDDQBZWPXDQSdKZrVAf2U6gAnxl4lSH3w";
        const long tokenCreatedAt = 1666018247603;

        return await ConnectAsync(tokenCreatedAt, $"?type={type}&version=2&token={token}");
    }
}