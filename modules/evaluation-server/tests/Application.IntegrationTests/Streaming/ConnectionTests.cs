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
        using var ws = await _app.ConnectToWsServerAsync();
        Assert.Equal(WebSocketState.Open, ws.State);
    }
}