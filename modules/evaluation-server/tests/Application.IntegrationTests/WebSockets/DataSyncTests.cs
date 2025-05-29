using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using Streaming.Connections;

namespace Application.IntegrationTests.WebSockets;

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
        var request = new
        {
            messageType = "data-sync",
            data = new
            {
                timestamp = 0
            }
        };

        await DoDataSyncAndVerifyAsync(ConnectionType.Server, request);
    }

    [Fact]
    public async Task DoClientDataSyncAsync()
    {
        var request = new
        {
            messageType = "data-sync",
            data = new
            {
                timestamp = 0,
                user = new
                {
                    keyId = "3db19c81-e149-4b97-8a0d-79d34531fe59",
                    name = "tester",
                    customizedProperties = new object[]
                    {
                        new
                        {
                            name = "email",
                            value = "tester@featbit.com"
                        },
                        new
                        {
                            name = "role",
                            value = "qa"
                        },
                        new
                        {
                            name = "location",
                            value = "127.0.0.1"
                        }
                    }
                }
            }
        };

        await DoDataSyncAndVerifyAsync(ConnectionType.Client, request);
    }

    [Fact]
    public async Task DoRelayProxyDataSyncAsync()
    {
        var request = new
        {
            messageType = "data-sync",
            data = new
            {
                timestamp = 0
            }
        };

        await DoDataSyncAndVerifyAsync(ConnectionType.RelayProxy, request);
    }

    private async Task DoDataSyncAndVerifyAsync(string type, object request)
    {
        var cts = new CancellationTokenSource(TimeSpan.FromSeconds(3));
        var cancellationToken = cts.Token;

        var ws = await _app.ConnectWithTokenAsync(type);

        var dataSync = JsonSerializer.SerializeToUtf8Bytes(request);
        await ws.SendAsync(dataSync, WebSocketMessageType.Text, true, cancellationToken);

        var buffer = new byte[8 * 1024];
        var result = await ws.ReceiveAsync(buffer, cancellationToken);

        Assert.True(result.EndOfMessage);
        Assert.Equal(WebSocketMessageType.Text, result.MessageType);

        var jsonString = Encoding.UTF8.GetString(buffer[..result.Count]);
        await VerifyJson(jsonString);
    }
}