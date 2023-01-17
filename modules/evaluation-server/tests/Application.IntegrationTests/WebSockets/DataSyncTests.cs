using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Domain.Core;
using Domain.Protocol;

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

        var jNode = JsonNode.Parse(buffer.AsSpan()[..result.Count]);
        Assert.NotNull(jNode);

        var jObject = jNode.AsObject();
        var messageTypeNode = jObject["messageType"];
        var dataNode = jObject["data"];
        Assert.NotNull(messageTypeNode);
        Assert.NotNull(dataNode);

        Assert.Equal("data-sync", messageTypeNode.ToString());

        var data = dataNode.Deserialize<ServerSdkPayload>(ReusableJsonSerializerOptions.Web);
        Assert.NotNull(data);
        Assert.Equal("full", data.EventType);
        Assert.Single(data.Segments);
        Assert.Single(data.FeatureFlags);
    }
}