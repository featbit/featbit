using System.Net.WebSockets;
using Domain.Shared;
using Microsoft.Extensions.Internal;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Logging.Testing;
using Moq;
using Streaming.Connections;
using Streaming.Services;

namespace Streaming.UnitTests.Messages;

public class RequestValidatorTests
{
    [Fact]
    public async Task Valid()
    {
        var validator = new RequestValidator(
            new TestSystemClock(TestData.ClientToken.Timestamp),
            new TestStore(),
            null!,
            NullLogger<RequestValidator>.Instance
        );

        var ctx = SetupTestContext();
        var validationResult = await validator.ValidateAsync(ctx);

        Assert.True(validationResult.IsValid);
        Assert.Empty(validationResult.Reason);

        Assert.Single(validationResult.Secrets);
        Assert.Equivalent(TestData.ClientSecret, validationResult.Secrets[0]);
    }

    [Fact]
    public async Task ValidRelayProxy()
    {
        var rpService = new Mock<IRelayProxyService>();
        rpService.Setup(x => x.GetSecretsAsync(It.IsAny<string>()))
            .ReturnsAsync([TestData.ClientSecret]);

        var ctx = SetupTestContext(type: ConnectionType.RelayProxy);
        var validator = new RequestValidator(
            new TestSystemClock(TestData.ClientToken.Timestamp),
            new TestStore(),
            rpService.Object,
            NullLogger<RequestValidator>.Instance
        );

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

    [Fact]
    public async Task InvalidRelayProxyToken()
    {
        var rpService = new Mock<IRelayProxyService>();
        rpService.Setup(x => x.GetSecretsAsync(It.IsAny<string>()))
            .ReturnsAsync([]);

        await EnsureInvalidAsync(
            expectedReason: "Invalid relay proxy token: rp-xxx",
            type: ConnectionType.RelayProxy,
            token: "rp-xxx",
            relayProxyService: rpService.Object
        );
    }

    [Fact]
    public async Task ValidationErrorThrowsAndLogged()
    {
        var errorStoreMock = new Mock<IStore>();
        errorStoreMock.Setup(x => x.GetSecretAsync(It.IsAny<string>()))
            .Throws(new Exception("Test exception"));

        var logger = new FakeLogger<RequestValidator>();

        var validator = new RequestValidator(
            new TestSystemClock(TestData.ClientToken.Timestamp),
            errorStoreMock.Object,
            null!,
            logger
        );

        var ctx = SetupTestContext();
        await Assert.ThrowsAsync<Exception>(() => validator.ValidateAsync(ctx));

        // assert exception is logged
        var latestLog = logger.LatestRecord;
        Assert.Equal(LogLevel.Error, latestLog.Level);
        Assert.Equal("Exception occurred while validating request: ?raw-query.", latestLog.Message);
        Assert.NotNull(latestLog.Exception);
    }

    private static async Task EnsureInvalidAsync(
        string expectedReason,
        WebSocket? webSocket = null,
        string? type = null,
        string? version = null,
        string? token = null,
        long? current = null,
        IStore? store = null,
        IRelayProxyService? relayProxyService = null)
    {
        var validator = new RequestValidator(
            new TestSystemClock(current ?? TestData.ClientToken.Timestamp),
            store ?? new TestStore(),
            relayProxyService ?? null!,
            NullLogger<RequestValidator>.Instance
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

        contextMock.Setup(x => x.RawQuery)
            .Returns("?raw-query");
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