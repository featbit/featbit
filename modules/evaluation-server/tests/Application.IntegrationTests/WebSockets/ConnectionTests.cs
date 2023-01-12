using System.Net.WebSockets;

namespace Application.IntegrationTests.WebSockets;

[Collection(nameof(TestApp))]
public class ConnectionTests
{
    private readonly TestApp _app;

    public ConnectionTests(TestApp app)
    {
        _app = app;
    }

    [Fact]
    public async Task ConnectToServer()
    {
        var ws = await _app.ConnectAsync();
        Assert.Equal(WebSocketState.Open, ws.State);
    }

    [Fact]
    public async Task CloseInvalidConnection()
    {
        var ws = await _app.ConnectAsync();

        var res = await ws.ReceiveAsync(new byte[100], CancellationToken.None);

        Assert.True(res.EndOfMessage);
        Assert.Equal(WebSocketMessageType.Close, res.MessageType);
        Assert.Equal(WebSocketState.CloseReceived, ws.State);
        Assert.Equal("invalid request, close by server", res.CloseStatusDescription);
        Assert.Equal((WebSocketCloseStatus)4003, res.CloseStatus);
    }
}