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

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task DoServerDataSyncAsync(bool multiFragment)
    {
        var request = new
        {
            messageType = "data-sync",
            data = new
            {
                timestamp = 0
            }
        };

        await DoDataSyncAndVerifyAsync(ConnectionType.Server, request, multiFragment);
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task DoClientDataSyncAsync(bool multiFragment)
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

        await DoDataSyncAndVerifyAsync(ConnectionType.Client, request, multiFragment);
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task DoRelayProxyDataSyncAsync(bool multiFragment)
    {
        var request = new
        {
            messageType = "data-sync",
            data = new
            {
                timestamp = 0
            }
        };

        await DoDataSyncAndVerifyAsync(ConnectionType.RelayProxy, request, multiFragment);
    }

    private async Task DoDataSyncAndVerifyAsync(string type, object request, bool multiFragment)
    {
        var cts = new CancellationTokenSource(TimeSpan.FromSeconds(3));
        var cancellationToken = cts.Token;

        var ws = await _app.ConnectWithTokenAsync(type);

        var dataSync = JsonSerializer.SerializeToUtf8Bytes(request);

        if (multiFragment)
        {
            var firstFragment = dataSync[..(dataSync.Length / 2)];
            var secondFragment = dataSync[(dataSync.Length / 2)..];

            await ws.SendAsync(firstFragment, WebSocketMessageType.Text, false, cancellationToken);
            await ws.SendAsync(secondFragment, WebSocketMessageType.Text, true, cancellationToken);
        }
        else
        {
            await ws.SendAsync(dataSync, WebSocketMessageType.Text, true, cancellationToken);
        }

        var buffer = new byte[16 * 1024];
        var result = await ws.ReceiveAsync(buffer, cancellationToken);

        Assert.True(result.EndOfMessage);
        Assert.Equal(WebSocketMessageType.Text, result.MessageType);

        var jsonString = Encoding.UTF8.GetString(buffer[..result.Count]);
        await VerifyJson(jsonString).UseParameters(multiFragment);
    }
}