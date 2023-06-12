using System.Net.WebSockets;
using Moq;
using Streaming.Connections;
using Streaming.Shared;

namespace Streaming.UnitTests.Messages;

public class RequestHandlerTests
{
    [Theory]
    [ClassData(typeof(Requests))]
    public void Should_Validate_Request(
        WebSocket webSocket, string sdkType, string version, string tokenString, long currentTimestamp, bool isValid)
    {
        Connection? TryAcceptRequest() =>
            RequestHandler.TryAcceptRequest(webSocket, sdkType, version, tokenString, currentTimestamp);

        if (isValid)
        {
            Assert.NotNull(TryAcceptRequest());
        }
        else
        {
            Assert.Null(TryAcceptRequest());
        }
    }
}

public class Requests : TheoryData<WebSocket, string, string, string, long, bool>
{
    public Requests()
    {
        const string sdkType = "client";
        const string version = "";
        const string token = TestData.DevStreamingTokenString;
        var tokenCreatedAt = TestData.DevStreamingToken.Timestamp;

        // mocked websockets
        var openedWebsocketMock = new Mock<WebSocket>();
        openedWebsocketMock.Setup(x => x.State).Returns(WebSocketState.Open);

        var abortedWebsocketMock = new Mock<WebSocket>();
        abortedWebsocketMock.Setup(x => x.State).Returns(WebSocketState.Closed);

        var openedWebsocket = openedWebsocketMock.Object;
        var abortedWebsocket = abortedWebsocketMock.Object;

        // valid
        Add(openedWebsocket, sdkType, version, token, tokenCreatedAt, true);

        // invalid websocket
        Add(null!, sdkType, version, token, tokenCreatedAt, false);
        Add(abortedWebsocket, sdkType, version, token, tokenCreatedAt, false);

        // invalid client
        Add(openedWebsocket, "invalid-client", version, token, tokenCreatedAt, false);

        // invalid version
        Add(openedWebsocket, sdkType, "invalid-version", token, tokenCreatedAt, false);

        // invalid token string
        Add(openedWebsocket, sdkType, version, "invalid-token-string", tokenCreatedAt, false);

        // invalid timestamp (after/before 31s)
        Add(openedWebsocket, sdkType, version, token, tokenCreatedAt + 31 * 1000, false);
        Add(openedWebsocket, sdkType, version, token, tokenCreatedAt - 31 * 1000, false);
    }
}