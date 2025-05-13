using System.Net.WebSockets;
using Domain.Shared;
using Microsoft.Extensions.Internal;
using Moq;
using Streaming.Connections;

namespace Streaming.UnitTests.Messages;

public class RequestValidatorTests
{
    [Fact]
    public async Task Valid()
    {
        var validator = new RequestValidator(
            new TestSystemClock(TestData.ClientToken.Timestamp),
            new TestStore(),
            null!
        );

        var ctx = SetupTestContext();
        var validationResult = await validator.ValidateAsync(ctx);

        Assert.True(validationResult.IsValid);
        Assert.Empty(validationResult.Reason);

        Assert.Single(validationResult.Secrets);
        Assert.Equivalent(TestData.ClientSecret, validationResult.Secrets[0]);
    }

    [Theory]
    [InlineData("")]
    [InlineData("unknown")]
    public async Task InvalidType(string type)
    {
        await EnsureInvalidAsync(
            expectedReason: $"Invalid type: {type}",
            type: type
        );
    }

    [Theory]
    [InlineData("unknown")]
    public async Task InvalidVersion(string version)
    {
        await EnsureInvalidAsync(
            expectedReason: $"Invalid version: {version}",
            version: version
        );
    }

    [Fact]
    public async Task InvalidWebSocketState()
    {
        var abortedWebsocketMock = new Mock<WebSocket>();
        abortedWebsocketMock.Setup(x => x.State).Returns(WebSocketState.Aborted);

        await EnsureInvalidAsync(
            expectedReason: "Invalid websocket state: Aborted",
            webSocket: abortedWebsocketMock.Object
        );
    }

    [Fact]
    public async Task InvalidToken()
    {
        await EnsureInvalidAsync(
            expectedReason: "Invalid token: ",
            token: string.Empty
        );

        await EnsureInvalidAsync(
            expectedReason: "Invalid token: 123456",
            token: "123456"
        );

        await EnsureInvalidAsync(
            expectedReason: $"Invalid token: {TestData.ClientTokenString}",
            current: TestData.ClientToken.Timestamp + 31 * 1000
        );

        await EnsureInvalidAsync(
            expectedReason: $"Invalid token: {TestData.ClientTokenString}",
            current: TestData.ClientToken.Timestamp - 31 * 1000
        );

        var nullStore = new Mock<IStore>();
        nullStore.Setup(x => x.GetSecretAsync(It.IsAny<string>())).ReturnsAsync(() => null);
        await EnsureInvalidAsync(
            expectedReason: $"Secret is not found: {TestData.ClientSecretString}",
            store: nullStore.Object
        );

        await EnsureInvalidAsync(
            expectedReason: $"Inconsistent secret used: {ConnectionType.Client}. Request type: {ConnectionType.Server}",
            type: ConnectionType.Server
        );
    }

    private static async Task EnsureInvalidAsync(
        string expectedReason,
        WebSocket? webSocket = null,
        string? type = null,
        string? version = null,
        string? token = null,
        long? current = null,
        IStore? store = null)
    {
        var validator = new RequestValidator(
            new TestSystemClock(current ?? TestData.ClientToken.Timestamp),
            store ?? new TestStore(),
            null!
        );

        var ctx = SetupTestContext(webSocket, type, version, token);
        var validationResult = await validator.ValidateAsync(ctx);

        Assert.False(validationResult.IsValid);
        Assert.Equal(expectedReason, validationResult.Reason);
        Assert.Empty(validationResult.Secrets);
    }

    private static WebsocketConnectionContext SetupTestContext(
        WebSocket? webSocket = null,
        string? type = null,
        string? version = null,
        string? token = null)
    {
        var openedWebsocketMock = new Mock<WebSocket>();
        openedWebsocketMock.Setup(x => x.State).Returns(WebSocketState.Open);

        var contextMock = new Mock<WebsocketConnectionContext>();

        contextMock
            .Setup(x => x.WebSocket)
            .Returns(webSocket ?? openedWebsocketMock.Object);
        contextMock
            .Setup(x => x.Type)
            .Returns(type ?? ConnectionType.Client);
        contextMock
            .Setup(x => x.Version)
            .Returns(version ?? ConnectionVersion.V2);
        contextMock
            .Setup(x => x.Token)
            .Returns(token ?? TestData.ClientTokenString);

        return contextMock.Object;
    }
}

internal class TestSystemClock(long current) : ISystemClock
{
    public DateTimeOffset UtcNow { get; } = DateTimeOffset.FromUnixTimeMilliseconds(current);
}