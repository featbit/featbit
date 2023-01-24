using System.Net.WebSockets;
using System.Text;
using Domain.WebSockets;

namespace Application.IntegrationTests.WebSockets;

[Collection(nameof(TestApp))]
public class PingTests
{
    private readonly TestApp _app;

    public PingTests(TestApp app)
    {
        _app = app;
    }

    [Fact]
    public async Task PingAsync()
    {
        var ws = await _app.ConnectWithTokenAsync();

        var ping = Encoding.UTF8.GetBytes(
            "{'messageType':'ping','data':{}}".Replace("'", "\"")
        );
        var pong = Message.Pong.Bytes.ToArray();

        await ws.SendAsync(ping, WebSocketMessageType.Text, true, CancellationToken.None);

        var buffer = new byte[100];
        var result = await ws.ReceiveAsync(buffer, CancellationToken.None);
        var bytesReceived = result.Count;

        Assert.True(result.EndOfMessage);
        Assert.Equal(WebSocketMessageType.Text, result.MessageType);
        Assert.Equal(ping.Length, bytesReceived);
        Assert.True(buffer[..bytesReceived].SequenceEqual(pong));
    }
}