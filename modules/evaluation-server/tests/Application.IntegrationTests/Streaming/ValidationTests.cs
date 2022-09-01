using System.Net.WebSockets;
using System.Text;

namespace Application.IntegrationTests.Streaming;

public class ValidationTests : IClassFixture<TestApp>
{
    private readonly TestApp _app;

    public ValidationTests(TestApp app)
    {
        _app = app;
    }

    [Fact]
    public async Task Should_Close_Invalid_Ws_Request()
    {
        using var ws = await _app.ConnectToWsServerAsync();

        var res = await ws.ReceiveAsync(new byte[100], CancellationToken.None);

        Assert.True(res.EndOfMessage);
        
        Assert.Equal(WebSocketMessageType.Close, res.MessageType);
        Assert.Equal(WebSocketState.CloseReceived, ws.State);
        Assert.Equal("invalid request, close by server", res.CloseStatusDescription);
        Assert.Equal((WebSocketCloseStatus)4003, res.CloseStatus);
    }

    [Fact(Skip = "should generate token dynamically or mock the DateTime.UtcNow")]
    public async Task Should_Say_Hello_Valid_Ws_Request()
    {
        const string token =
            "QXBBHYWVkLWNiZTgtNCUyMDIyMDEwODA5MjIzNF9fOTRfXzExMV9fMjM3X19kZWZhdWx0XzRmOWRQQBDDBUPHZHWZUZh"; 
        
        using var ws = await _app.ConnectToWsServerAsync($"?type=client&version=2&token={token}");

        var message = new byte[100];
        var res = await ws.ReceiveAsync(message, CancellationToken.None);
        
        Assert.True(res.EndOfMessage);
        Assert.Equal(WebSocketMessageType.Text, res.MessageType);
        Assert.Equal("hello, client!", Encoding.UTF8.GetString(message, 0, res.Count));
    }
}