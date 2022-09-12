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
    public async Task ConnectToServer()
    {
        using var ws = await _app.ConnectAsync();
        Assert.Equal(WebSocketState.Open, ws.State);
    }
    
    [Fact]
    public async Task CloseInvalidConnection()
    {
        using var ws = await _app.ConnectAsync();

        var res = await ws.ReceiveAsync(new byte[100], CancellationToken.None);

        Assert.True(res.EndOfMessage);
        Assert.Equal(WebSocketMessageType.Close, res.MessageType);
        Assert.Equal(WebSocketState.CloseReceived, ws.State);
        Assert.Equal("invalid request, close by server", res.CloseStatusDescription);
        Assert.Equal((WebSocketCloseStatus)4003, res.CloseStatus);
    }
}