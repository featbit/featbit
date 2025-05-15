using System.Net.WebSockets;
using Domain.Shared;
using Microsoft.Extensions.Internal;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Logging.Testing;
using Moq;
using Streaming.Connections;
using Streaming.Services;
using Streaming.UnitTests.Connections;

namespace Streaming.UnitTests.Messages;

public class RequestValidatorTests
{
    [Fact]
    public async Task Valid()
    {
        var context = SetupTestContext();
        var validator = SetupValidator();

        var validationResult = await validator.ValidateAsync(context);

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

        var context = SetupTestContext(type: ConnectionType.RelayProxy);
        var validator = SetupValidator(rpService: rpService.Object);

        var validationResult = await validator.ValidateAsync(context);
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
            rpService: rpService.Object
        );
    }

    [Fact]
    public async Task ValidationErrorThrowsAndLogged()
    {
        var errorStoreMock = new Mock<IStore>();
        errorStoreMock.Setup(x => x.GetSecretAsync(It.IsAny<string>()))
            .Throws(new Exception("Test exception"));

        var logger = new FakeLogger<RequestValidator>();

        var context = SetupTestContext();
        var validator = SetupValidator(store: errorStoreMock.Object, logger: logger);

        await Assert.ThrowsAsync<Exception>(() => validator.ValidateAsync(context));

        // assert exception is logged
        var latestLog = logger.LatestRecord;
        Assert.Equal(LogLevel.Error, latestLog.Level);
        Assert.Equal($"Exception occurred while validating request: {context.RawQuery}.", latestLog.Message);
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
        StreamingOptions? streamingOptions = null,
        IRelayProxyService? rpService = null)
    {
        var context = SetupTestContext(webSocket, type, version, token);
        var validator = SetupValidator(current, store, streamingOptions, rpService);

        var validationResult = await validator.ValidateAsync(context);

        Assert.False(validationResult.IsValid);
        Assert.Equal(expectedReason, validationResult.Reason);
        Assert.Empty(validationResult.Secrets);
    }

    private static RequestValidator SetupValidator(
        long? current = null,
        IStore? store = null,
        StreamingOptions? streamingOptions = null,
        IRelayProxyService? rpService = null,
        ILogger<RequestValidator>? logger = null)
    {
        var spMock = new Mock<IServiceProvider>();
        spMock.Setup(x => x.GetService(typeof(IRelayProxyService))).Returns(rpService);

        var validator = new RequestValidator(
            new TestSystemClock(current ?? TestData.ClientToken.Timestamp),
            store ?? new TestStore(),
            streamingOptions ?? new StreamingOptions(),
            rpService == null ? null! : spMock.Object,
            logger ?? NullLogger<RequestValidator>.Instance
        );

        return validator;
    }

    private static ConnectionContext SetupTestContext(
        WebSocket? webSocket = null,
        string? type = null,
        string? version = null,
        string? token = null)
    {
        var openedWebsocketMock = new Mock<WebSocket>();
        openedWebsocketMock.Setup(x => x.State).Returns(WebSocketState.Open);

        var ctx = new ConnectionContextBuilder()
            .WithWebSocket(webSocket ?? openedWebsocketMock.Object)
            .WithType(type ?? ConnectionType.Client)
            .WithVersion(version ?? ConnectionVersion.V2)
            .WithToken(token ?? TestData.ClientTokenString)
            .Build();

        return ctx;
    }
}

internal class TestSystemClock(long current) : ISystemClock
{
    public DateTimeOffset UtcNow { get; } = DateTimeOffset.FromUnixTimeMilliseconds(current);
}