using System.Net.WebSockets;
using System.Text;

namespace Application.IntegrationTests.WebSockets;

public class EchoTests : IClassFixture<TestApp>
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
        
        const string message = "hello, world!";
        var payload = Encoding.UTF8.GetBytes(message);

        if (multiFragment)
        {
            await ws.SendAsync(payload[..2], WebSocketMessageType.Text, false, CancellationToken.None);
            await ws.SendAsync(payload[2..4], WebSocketMessageType.Text, false, CancellationToken.None);
            await ws.SendAsync(payload[4..], WebSocketMessageType.Text, true, CancellationToken.None);
        }
        else
        {
            await ws.SendAsync(payload, WebSocketMessageType.Text, true, CancellationToken.None);
        }
        
        var buffer = new byte[100];
        var result = await ws.ReceiveAsync(buffer, CancellationToken.None);
        
        Assert.True(result.EndOfMessage);
        Assert.Equal(WebSocketMessageType.Text, result.MessageType);
        Assert.Equal(message, Encoding.UTF8.GetString(buffer, 0, result.Count));
    }
}