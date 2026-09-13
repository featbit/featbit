using System.Net.WebSockets;
using System.Text;
using Domain.Observability;
using FeatBit.Observability.TestKit;
using Streaming.Messages;
using Streaming.Protocol;

namespace Application.IntegrationTests.WebSockets;

[Trait("Category", "Host")]
[Collection(nameof(TestApp))]
public class PingTests
{
    private readonly TestApp _app;

    public PingTests(TestApp app)
    {
        _app = app;
    }

    [Fact]
    public async Task PingMessage_ValidConnection_ServerRepliesWithPong()
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

    /// <summary>
    /// The pong reply travels through the pre-serialized <c>SendAsync(ReadOnlyMemory&lt;byte&gt;)</c>
    /// overload rather than the <c>ServerMessage</c> one, so P15 instrumented every outbound frame
    /// except this one. A live export run caught it: <c>ping</c> appeared in
    /// <c>received_message_size</c> with no matching send. This pins the fix so the raw-bytes
    /// overload cannot silently go unmeasured again.
    /// </summary>
    [Fact]
    public async Task PingMessage_ValidConnection_RecordsPongSentMessageSize()
    {
        using var collector = new MetricCollector(StreamingMetrics.Current.Meter);

        var ws = await _app.ConnectWithTokenAsync();

        var ping = Encoding.UTF8.GetBytes("{\"messageType\":\"ping\",\"data\":{}}");
        await ws.SendAsync(ping, WebSocketMessageType.Text, true, CancellationToken.None);

        var buffer = new byte[100];
        var result = await ws.ReceiveAsync(buffer, CancellationToken.None);

        var sent = Assert.Single(
            collector.For("streaming.sent_message_size"),
            m => (string?)m.Tag(ObservabilityTags.Operation) == MessageTypes.Pong);

        Assert.Equal((long)result.Count, Convert.ToInt64(sent.Value));
    }
}