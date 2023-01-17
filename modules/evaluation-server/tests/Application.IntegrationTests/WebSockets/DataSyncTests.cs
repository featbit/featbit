using System.Net.WebSockets;
using System.Text;
using System.Text.Json;

namespace Application.IntegrationTests.WebSockets;

[UsesVerify]
[Collection(nameof(TestApp))]
public class DataSyncTests
{
    private readonly TestApp _app;

    public DataSyncTests(TestApp app)
    {
        _app = app;
    }

    [Theory]
    [InlineData("server", "{'messageType':'data-sync','data':{'timestamp': 0}}")]
    public async Task DoServerDataSyncAsync(string type, string jsonMessage)
    {
        var ws = await _app.ConnectWithTokenAsync(type);
        var dataSync = Encoding.UTF8.GetBytes(jsonMessage.Replace("'", "\""));

        await ws.SendAsync(dataSync, WebSocketMessageType.Text, true, CancellationToken.None);

        var buffer = new byte[4 * 1024];
        var result = await ws.ReceiveAsync(buffer, CancellationToken.None);

        Assert.True(result.EndOfMessage);
        Assert.Equal(WebSocketMessageType.Text, result.MessageType);

        using var response = JsonDocument.Parse(buffer.AsMemory()[..result.Count]);
        await Verify(response);
    }
}