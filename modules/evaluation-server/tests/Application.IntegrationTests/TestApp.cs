using System.Net.WebSockets;
using Domain.Shared;
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
        builder.UseSetting("IntegrationTests", "true");

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
        var token = type == "client"
            ? TestData.ClientTokenString
            : TestData.ServerTokenString;

        var tokenCreatedAt = type == "client"
            ? TestData.ClientToken.Timestamp
            : TestData.ServerToken.Timestamp;

        return await ConnectAsync(tokenCreatedAt, $"?type={type}&version=2&token={token}");
    }
}