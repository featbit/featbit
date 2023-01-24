using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using Domain.WebSockets;

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

    [Fact]
    public async Task DoServerDataSyncAsync()
    {
        const string request =
            "{'messageType':'data-sync','data':{'timestamp':0}}";

        await DoDataSyncAndVerifyAsync(ConnectionType.Server, request);
    }

    [Fact]
    public async Task DoClientDataSyncAsync()
    {
        const string request =
            "{'messageType':'data-sync', 'data':{'timestamp': 0, 'user': {'keyId':'3db19c81-e149-4b97-8a0d-79d34531fe59','name':'tester'}}}";

        await DoDataSyncAndVerifyAsync(ConnectionType.Client, request);
    }

    private async Task DoDataSyncAndVerifyAsync(string type, string jsonMessage)
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