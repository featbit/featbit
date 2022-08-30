using System.Net.WebSockets;

namespace Application.IntegrationTests.Streaming;

public class ConnectionTests : IClassFixture<TestApp>
{
    private readonly TestApp _app;

    public ConnectionTests(TestApp app)
    {
        _app = app;
    }
    
    [Fact]
    public async Task Should_Connect_To_Ws_Server()
    {
        var server = _app.Server;
        var webSocketClient = server.CreateWebSocketClient();
        var streamingUrl = new Uri(server.BaseAddress, "streaming");

        var ws = await webSocketClient.ConnectAsync(streamingUrl, CancellationToken.None);

        Assert.Equal(WebSocketState.Open, ws.State);
    }
}