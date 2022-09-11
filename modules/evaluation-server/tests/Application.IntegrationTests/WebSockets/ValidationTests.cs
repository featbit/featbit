using System.Net.WebSockets;
using System.Text;

namespace Application.IntegrationTests.WebSockets;

public class ValidationTests : IClassFixture<TestApp>
{
    private readonly StreamingTestApp _app;

    public ValidationTests(TestApp app)
    {
        _app = new StreamingTestApp(app);
    }

    [Fact]
    public async Task Should_Close_Invalid_Ws_Request()
    {
        using var ws = await _app.ConnectAsync();

        var res = await ws.ReceiveAsync(new byte[100], CancellationToken.None);

        Assert.True(res.EndOfMessage);
        
        Assert.Equal(WebSocketMessageType.Close, res.MessageType);
        Assert.Equal(WebSocketState.CloseReceived, ws.State);
        Assert.Equal("invalid request, close by server", res.CloseStatusDescription);
        Assert.Equal((WebSocketCloseStatus)4003, res.CloseStatus);
    }

    [Fact]
    public async Task Should_Say_Hello_To_Valid_Ws_Request()
    {
        const long tokenCreatedAt = 1661907157706;
        const string token =
            "QPXBHMWIxLWQ0NWUtNCUyMDIyMDgwMjA2MzUzNl9fMTYxX18yMDRQQBDDBUQXBHXXQDfXzQyMV9fZGVmYXVsdF84ZDBmZQ";
        
        using var ws = await _app.ConnectAsync(tokenCreatedAt, $"?type=client&version=2&token={token}");

        var message = new byte[100];
        var res = await ws.ReceiveAsync(message, CancellationToken.None);
        
        Assert.True(res.EndOfMessage);
        Assert.Equal(WebSocketMessageType.Text, res.MessageType);
        Assert.Equal("hello, client!", Encoding.UTF8.GetString(message, 0, res.Count));
    }
}