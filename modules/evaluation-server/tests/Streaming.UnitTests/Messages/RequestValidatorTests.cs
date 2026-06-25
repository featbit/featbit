using System.Net.WebSockets;
using Domain.Shared;
using Microsoft.Extensions.Internal;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Logging.Testing;
using Moq;
using Streaming.Connections;
using Streaming.Services;
using Streaming.UnitTests.Builders;

namespace Streaming.UnitTests.Messages;

public class RequestValidatorTests
{
    [Fact]
    public async Task ValidateAsync_ValidClientRequest_ReturnsSecretForEnvironment()
    {
        var context = SetupTestContext();
        var validator = SetupValidator();

        var validationResult = await validator.ValidateAsync(context);

        Assert.True(validationResult.IsValid);
        Assert.Empty(validationResult.Reason);

        Assert.Single(validationResult.Secrets);
        Assert.Equivalent(TestData.ClientSecret, validationResult.Secrets[0], strict: true);
    }

    [Fact]
    public async Task ValidateAsync_ValidRelayProxyRequest_ReturnsAllServerSecretsForProxy()
    {
        var rpService = new Mock<IRelayProxyService>();

        Secret[] secrets =
        [
            new(SecretTypes.Server, "p1", Guid.NewGuid(), "prod"),
            new(SecretTypes.Server, "p2", Guid.NewGuid(), "prod")
        ];

        rpService.Setup(x => x.GetServerSecretsAsync(It.IsAny<string>())).ReturnsAsync(secrets);

        var context = SetupTestContext(type: ConnectionType.RelayProxy);
        var validator = SetupValidator(rpService: rpService.Object);

        var validationResult = await validator.ValidateAsync(context);
        Assert.True(validationResult.IsValid);
        Assert.Empty(validationResult.Reason);

        Assert.Equal(2, validationResult.Secrets.Length);
        Assert.Equivalent(secrets[0], validationResult.Secrets[0], strict: true);
        Assert.Equivalent(secrets[1], validationResult.Secrets[1], strict: true);
    }

    [Theory]
    [InlineData("")]
    [InlineData("unknown")]
    public async Task ValidateAsync_UnknownOrEmptyConnectionType_FailsWithInvalidType(string type)
    {
        await EnsureInvalidAsync(
            expectedReason: $"Invalid type: {type}",
            type: type
        );
    }

    [Theory]
    [InlineData("unknown")]
    public async Task ValidateAsync_UnsupportedProtocolVersion_FailsWithInvalidVersion(string version)
    {
        await EnsureInvalidAsync(
            expectedReason: $"Invalid version: {version}",
            version: version
        );
    }

    [Fact]
    public async Task ValidateAsync_WebSocketNotOpen_FailsWithInvalidWebSocketState()
    {
        var abortedWebsocketMock = new Mock<WebSocket>();
        abortedWebsocketMock.Setup(x => x.State).Returns(WebSocketState.Aborted);

        await EnsureInvalidAsync(
            expectedReason: "Invalid websocket state: Aborted",
            webSocket: abortedWebsocketMock.Object
        );
    }

    [Fact]
    public async Task ValidateAsync_EmptyToken_FailsWithInvalidToken()
    {
        await EnsureInvalidAsync(
            expectedReason: "Invalid token: ",
            token: string.Empty
        );
    }

    [Fact]
    public async Task ValidateAsync_MalformedToken_FailsWithInvalidToken()
    {
        await EnsureInvalidAsync(
            expectedReason: "Invalid token: 123456",
            token: "123456"
        );
    }

    [Fact]
    public async Task ValidateAsync_TokenIssuedTooFarInPast_FailsWithExpired()
    {
        await EnsureInvalidAsync(
            expectedReason: $"Token is expired: {TestData.ClientTokenString}",
            current: TestData.ClientToken.Timestamp + 31 * 1000
        );
    }

    [Fact]
    public async Task ValidateAsync_TokenIssuedTooFarInFuture_FailsWithExpired()
    {
        await EnsureInvalidAsync(
            expectedReason: $"Token is expired: {TestData.ClientTokenString}",
            current: TestData.ClientToken.Timestamp - 31 * 1000
        );
    }

    [Fact]
    public async Task ValidateAsync_SecretNotFoundInStore_FailsWithSecretNotFound()
    {
        var nullStore = new Mock<IStore>();
        nullStore.Setup(x => x.GetSecretAsync(It.IsAny<string>())).ReturnsAsync(() => null);

        await EnsureInvalidAsync(
            expectedReason: $"Secret is not found: {TestData.ClientSecretString}",
            store: nullStore.Object
        );
    }

    [Fact]
    public async Task ValidateAsync_ClientSecretUsedAsServerConnection_FailsWithInconsistentSecret()
    {
        await EnsureInvalidAsync(
            expectedReason: $"Inconsistent secret used: {SecretTypes.Client}. Request type: {ConnectionType.Server}",
            type: ConnectionType.Server
        );
    }

    [Fact]
    public async Task ValidateAsync_RelayProxyTokenNotInService_FailsWithInvalidRelayProxyToken()
    {
        var rpService = new Mock<IRelayProxyService>();
        rpService.Setup(x => x.GetServerSecretsAsync(It.IsAny<string>()))
            .ReturnsAsync([]);

        await EnsureInvalidAsync(
            expectedReason: "Invalid relay proxy token: rp-xxx",
            type: ConnectionType.RelayProxy,
            token: "rp-xxx",
            rpService: rpService.Object
        );
    }

    [Fact]
    public async Task ValidateAsync_StoreThrowsException_LogsErrorAndRethrows()
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
        var mockedStore = Mock.Of<IStore>(x =>
            x.GetSecretAsync(TestData.ClientSecretString) == Task.FromResult(TestData.ClientSecret)
        );

        var validator = new RequestValidator(
            new TestSystemClock(current ?? TestData.ClientToken.Timestamp),
            store ?? mockedStore,
            streamingOptions ?? new StreamingOptions(),
            rpService ?? null!,
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