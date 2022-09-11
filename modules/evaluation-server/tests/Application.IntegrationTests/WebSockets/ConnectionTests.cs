using System.Net.WebSockets;

namespace Application.IntegrationTests.WebSockets;

public class ConnectionTests : IClassFixture<TestApp>
{
    private readonly StreamingTestApp _app;

    public ConnectionTests(TestApp app)
    {
        _app = new StreamingTestApp(app);
    }
    
    [Fact]
    public async Task Should_Connect_To_Ws_Server()
    {
        using var ws = await _app.ConnectAsync();
        Assert.Equal(WebSocketState.Open, ws.State);
    }
}