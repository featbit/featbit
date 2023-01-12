using System.Net.WebSockets;
using System.Text;

namespace Application.IntegrationTests.WebSockets;

[Collection(nameof(TestApp))]
public class EchoTests
{
    private readonly TestApp _app;

    public EchoTests(TestApp app)
    {
        _app = app;
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task DoEchoAsync(bool multiFragment)
    {
        var ws = await _app.ConnectWithTokenAsync();

        var echo = Encoding.UTF8.GetBytes(
            "{'messageType':'echo','data':{}}".Replace("'", "\"")
        );

        if (multiFragment)
        {
            await ws.SendAsync(echo[..10], WebSocketMessageType.Text, false, CancellationToken.None);
            await ws.SendAsync(echo[10..14], WebSocketMessageType.Text, false, CancellationToken.None);
            await ws.SendAsync(echo[14..], WebSocketMessageType.Text, true, CancellationToken.None);
        }
        else
        {
            await ws.SendAsync(echo, WebSocketMessageType.Text, true, CancellationToken.None);
        }

        var buffer = new byte[100];
        var result = await ws.ReceiveAsync(buffer, CancellationToken.None);
        var bytesReceived = result.Count;

        Assert.True(result.EndOfMessage);
        Assert.Equal(WebSocketMessageType.Text, result.MessageType);
        Assert.Equal(echo.Length, bytesReceived);
        Assert.True(buffer[..bytesReceived].SequenceEqual(echo));
    }
}