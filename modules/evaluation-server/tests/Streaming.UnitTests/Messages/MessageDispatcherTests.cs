using System.Net.WebSockets;
using System.Text;
using Microsoft.Extensions.Logging.Testing;
using Moq;
using Streaming.Connections;
using Streaming.Messages;
using Streaming.UnitTests.Connections;

namespace Streaming.UnitTests.Messages;

public class MessageDispatcherTests
{
    private readonly Mock<WebSocket> _wsMock;
    private readonly Connection _connection;
    private readonly MessageDispatcher _dispatcher;
    private readonly FakeLogger<MessageDispatcher> _logger = new();

    private readonly byte[] _echoMessage = "{\"messageType\":\"echo\",\"data\":{\"value\":\"test\"}}"u8.ToArray();

    public MessageDispatcherTests()
    {
        _wsMock = new Mock<WebSocket>();

        // close after first dispatch
        _wsMock.SetupSequence(ws => ws.State)
            .Returns(WebSocketState.Open)
            .Returns(WebSocketState.Closed);

        // setup first 0 bytes read
        _wsMock
            .Setup(ws => ws.ReceiveAsync(It.IsAny<Memory<byte>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ValueWebSocketReceiveResult(0, WebSocketMessageType.Text, false));

        _connection = new ConnectionBuilder()
            .WithWebSocket(_wsMock.Object)
            .Build();

        _dispatcher = new MessageDispatcher([new EchoMessageHandler()], _logger);
    }

    [Fact]
    public async Task EchoSingleFragmentMessage()
    {
        _wsMock.SetupSequence(ws => ws.State)
            .Returns(WebSocketState.Open)
            .Returns(WebSocketState.Closed);

        SetupReceive([_echoMessage]);

        await _dispatcher.DispatchAsync(_connection, CancellationToken.None);

        VerifyMessageEchoed();
    }

    [Fact]
    public async Task EchoMultiFragmentMessage()
    {
        _wsMock.SetupSequence(ws => ws.State)
            .Returns(WebSocketState.Open)
            .Returns(WebSocketState.Closed);

        var firstHalf = _echoMessage.Take(_echoMessage.Length / 2).ToArray();
        var secondHalf = _echoMessage.Skip(_echoMessage.Length / 2).ToArray();

        SetupReceive([firstHalf, secondHalf]);

        await _dispatcher.DispatchAsync(_connection, CancellationToken.None);

        VerifyMessageEchoed();
    }

    [Fact]
    public async Task CloseMessage()
    {
        _wsMock
            .Setup(ws => ws.ReceiveAsync(It.IsAny<Memory<byte>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ValueWebSocketReceiveResult(0, WebSocketMessageType.Close, true));

        await _dispatcher.DispatchAsync(_connection, CancellationToken.None);

        Assert.Equal("Received close message", _logger.LatestRecord.Message);

        VerifyEchoHandlerNeverCalled();
    }

    [Fact]
    public async Task EmptyMessage()
    {
        _wsMock
            .Setup(ws => ws.ReceiveAsync(It.IsAny<Memory<byte>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ValueWebSocketReceiveResult(0, WebSocketMessageType.Text, true));

        await _dispatcher.DispatchAsync(_connection, CancellationToken.None);

        Assert.Equal("Received empty message", _logger.LatestRecord.Message);

        VerifyEchoHandlerNeverCalled();
    }

    [Fact]
    public async Task TooManyFragments()
    {
        _wsMock.SetupSequence(ws => ws.State)
            .Returns(WebSocketState.Open)
            .Returns(WebSocketState.Closed);

        // 5 fragments
        SetupReceive([[], [], [], [], [], []]);

        await _dispatcher.DispatchAsync(_connection, CancellationToken.None);

        Assert.Equal("Too many fragments for message", _logger.LatestRecord.Message);

        VerifyEchoHandlerNeverCalled();
    }

    [Fact]
    public async Task NoHandler()
    {
        var message = "{\"messageType\":\"unknown\",\"data\":{\"value\":\"test\"}}"u8.ToArray();

        SetupReceive([message]);

        await _dispatcher.DispatchAsync(_connection, CancellationToken.None);

        Assert.Equal("No handler for message type: unknown", _logger.LatestRecord.Message);

        VerifyEchoHandlerNeverCalled();
    }

    [Theory]
    [InlineData("")]
    [InlineData("hello world")]
    [InlineData("{\"messageType\":\"echo\",\"data\":{\"value\":\"test\"")]
    public async Task InvalidMessage(string message)
    {
        var bytes = Encoding.UTF8.GetBytes(message);

        SetupReceive([bytes]);

        await _dispatcher.DispatchAsync(_connection, CancellationToken.None);

        Assert.Equal($"Received invalid message: {message}", _logger.LatestRecord.Message);

        VerifyEchoHandlerNeverCalled();
    }

    private void SetupReceive(byte[][] expectedResults)
    {
        var sequence = new MockSequence();

        for (var i = 0; i < expectedResults.Length; i++)
        {
            var expectedResult = expectedResults[i];

            _wsMock.InSequence(sequence)
                .Setup(x => x.ReceiveAsync(It.IsAny<ArraySegment<byte>>(), It.IsAny<CancellationToken>()))
                .Callback((ArraySegment<byte> buffer, CancellationToken _) =>
                {
                    var src = new ArraySegment<byte>(expectedResult);
                    src.CopyTo(buffer);
                })
                .ReturnsAsync(new WebSocketReceiveResult(
                    expectedResult.Length,
                    WebSocketMessageType.Text,
                    i == expectedResults.Length - 1)
                );
        }
    }

    private void VerifyMessageEchoed()
    {
        _wsMock.Verify(
            x => x.SendAsync(
                It.Is<ArraySegment<byte>>(y => y.SequenceEqual(_echoMessage)),
                WebSocketMessageType.Text, true, It.IsAny<CancellationToken>()
            ), Times.Once
        );
    }

    private void VerifyEchoHandlerNeverCalled()
    {
        _wsMock.Verify(
            x => x.SendAsync(
                It.IsAny<ArraySegment<byte>>(),
                WebSocketMessageType.Text, true, It.IsAny<CancellationToken>()
            ), Times.Never
        );
    }
}