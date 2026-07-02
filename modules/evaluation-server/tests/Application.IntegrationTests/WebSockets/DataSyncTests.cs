using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using Infrastructure.Fakes;
using Streaming.Connections;
using Streaming.Protocol;

namespace Application.IntegrationTests.WebSockets;

[Collection(nameof(TestApp))]
public class DataSyncTests(TestApp app)
{
    // 2023-01-28T05:55:00.000Z, filter out 4 feature flags and 1 segment
    private const long PatchTs = 1674885300000;

    [Theory]
    [InlineData(DataSyncEventTypes.Full)]
    [InlineData(DataSyncEventTypes.Patch)]
    public async Task DoServerDataSyncAsync(string type)
    {
        var timestamp = type == DataSyncEventTypes.Full ? 0 : PatchTs;

        var request = new
        {
            messageType = "data-sync",
            data = new
            {
                timestamp
            }
        };

        var r1 = await DoDataSyncAsync(ConnectionType.Server, request, true);
        var r2 = await DoDataSyncAsync(ConnectionType.Server, request, false);

        Assert.Equal(r1, r2);
        await VerifyJson(r1).UseParameters(type);
    }

    [Theory]
    [InlineData(DataSyncEventTypes.Full)]
    [InlineData(DataSyncEventTypes.Patch)]
    public async Task DoClientDataSyncAsync(string type)
    {
        var timestamp = type == DataSyncEventTypes.Full ? 0 : PatchTs;

        var request = new
        {
            messageType = "data-sync",
            data = new
            {
                timestamp,
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

        var r1 = await DoDataSyncAsync(ConnectionType.Client, request, true);
        var r2 = await DoDataSyncAsync(ConnectionType.Client, request, false);

        Assert.Equal(r1, r2);
        await VerifyJson(r1).UseParameters(type);
    }

    [Theory]
    [InlineData(DataSyncEventTypes.Full)]
    [InlineData(DataSyncEventTypes.Patch)]
    public async Task DoRelayProxyDataSyncAsync(string type)
    {
        var timestamp = type == DataSyncEventTypes.Full ? 0 : PatchTs;

        var request = new
        {
            messageType = "data-sync",
            data = new
            {
                timestamp,
                envs = new object[]
                {
                    new
                    {
                        envId = FakeData.EnvId,
                        timestamp
                    }
                }
            }
        };

        var r1 = await DoDataSyncAsync(ConnectionType.RelayProxy, request, true);
        var r2 = await DoDataSyncAsync(ConnectionType.RelayProxy, request, false);

        Assert.Equal(r1, r2);
        await VerifyJson(r1).UseParameters(type);
    }

    private async Task<string> DoDataSyncAsync(string type, object request, bool multiFragment)
    {
        var cts = new CancellationTokenSource(TimeSpan.FromSeconds(3));
        var cancellationToken = cts.Token;

        var ws = await app.ConnectWithTokenAsync(type);

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

        var buffer = new byte[8 * 1024];
        var result = await ws.ReceiveAsync(buffer, cancellationToken);

        Assert.True(result.EndOfMessage);
        Assert.Equal(WebSocketMessageType.Text, result.MessageType);

        var jsonString = Encoding.UTF8.GetString(buffer[..result.Count]);
        return jsonString;
    }
}