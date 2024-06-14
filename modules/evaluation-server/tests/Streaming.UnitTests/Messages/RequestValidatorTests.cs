using System.Net.WebSockets;
using Domain.Shared;
using Infrastructure.Store;
using Microsoft.Extensions.Internal;
using Moq;
using Streaming.Connections;

namespace Streaming.UnitTests.Messages;

public class RequestValidatorTests
{
    [Theory]
    [ClassData(typeof(Requests))]
    public async Task Should_Validate_Request(WebSocket webSocket, string type, string version, string tokenString,
        long currentTimestamp, bool isValid)
    {
        var validator = new RequestValidator(new TestSystemClock(currentTimestamp), new TestStore());

        var connection = await validator.ValidateAsync(webSocket, type, version, tokenString);
        if (isValid)
        {
            Assert.NotNull(connection);
        }
        else
        {
            Assert.Null(connection);
        }
    }
}

internal class TestSystemClock : ISystemClock
{
    public TestSystemClock(long timestamp)
    {
        UtcNow = DateTimeOffset.FromUnixTimeMilliseconds(timestamp);
    }

    public DateTimeOffset UtcNow { get; }
}

internal class TestStore : EmptyStore
{
    public override string Name => "Test";

    public override Task<Secret?> GetSecretAsync(string secretString) =>
        Task.FromResult(TestData.GetSecret(secretString));
}

public class Requests : TheoryData<WebSocket, string, string, string, long, bool>
{
    public Requests()
    {
        const string server = ConnectionType.Client;
        const string version = "";
        const string token = TestData.ClientTokenString;
        var tokenCreatedAt = TestData.ClientToken.Timestamp;

        // mocked websockets
        var openedWebsocketMock = new Mock<WebSocket>();
        openedWebsocketMock.Setup(x => x.State).Returns(WebSocketState.Open);

        var abortedWebsocketMock = new Mock<WebSocket>();
        abortedWebsocketMock.Setup(x => x.State).Returns(WebSocketState.Closed);

        var openedWebsocket = openedWebsocketMock.Object;
        var abortedWebsocket = abortedWebsocketMock.Object;

        // valid
        Add(openedWebsocket, server, version, token, tokenCreatedAt, true);

        // invalid websocket
        Add(null!, server, version, token, tokenCreatedAt, false);
        Add(abortedWebsocket, server, version, token, tokenCreatedAt, false);

        // invalid client
        Add(openedWebsocket, "invalid-client", version, token, tokenCreatedAt, false);

        // invalid version
        Add(openedWebsocket, server, "invalid-version", token, tokenCreatedAt, false);

        // invalid token string
        Add(openedWebsocket, server, version, "invalid-token-string", tokenCreatedAt, false);

        // invalid timestamp (after/before 31s)
        Add(openedWebsocket, server, version, token, tokenCreatedAt + 31 * 1000, false);
        Add(openedWebsocket, server, version, token, tokenCreatedAt - 31 * 1000, false);
    }
}