using System.Net.WebSockets;
using System.Text;
using Streaming.Connections;

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
        var cts = new CancellationTokenSource(TimeSpan.FromSeconds(3));
        var cancellationToken = cts.Token;

        var ws = await _app.ConnectWithTokenAsync(type);
        var dataSync = Encoding.UTF8.GetBytes(jsonMessage.Replace("'", "\""));

        await ws.SendAsync(dataSync, WebSocketMessageType.Text, true, cancellationToken);

        var buffer = new byte[8 * 1024];
        var result = await ws.ReceiveAsync(buffer, cancellationToken);

        Assert.True(result.EndOfMessage);
        Assert.Equal(WebSocketMessageType.Text, result.MessageType);

        var jsonString = Encoding.UTF8.GetString(buffer[..result.Count]);
        await VerifyJson(jsonString);
    }
}