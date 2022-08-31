using System.Net.WebSockets;
using Microsoft.AspNetCore.Mvc.Testing;

namespace Application.IntegrationTests;

public class TestApp : WebApplicationFactory<Program>
{
    public async Task<WebSocket> ConnectToWsServerAsync(string queryString = "")
    {
        var client = Server.CreateWebSocketClient();
        var streamingUri = new Uri($"http://localhost/streaming{queryString}");

        var ws = await client.ConnectAsync(streamingUri, CancellationToken.None);
        return ws;
    }
}