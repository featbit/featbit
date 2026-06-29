using Domain.Shared;
using Domain.Shared.Authentication;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Internal;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Streaming.Connections;
using Streaming.Services;

namespace Streaming.UnitTests.Messages;

public class RequestValidatorTests
{
    [Fact]
    public async Task Valid()
    {
        var context = SetupTestContext();
        var validator = SetupValidator();

        var validationResult = await validator.ValidateAsync(context);

        Assert.Equal(ValidationResultStatus.Valid, validationResult.Status);
        Assert.Empty(validationResult.Reason);

        Assert.Single(validationResult.Secrets);
        Assert.Equivalent(TestData.ClientSecret, validationResult.Secrets[0], strict: true);
    }

    [Fact]
    public async Task ValidRelayProxy()
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
        Assert.Equal(ValidationResultStatus.Valid, validationResult.Status);
        Assert.Empty(validationResult.Reason);

        Assert.Equal(2, validationResult.Secrets.Length);
        Assert.Equivalent(secrets[0], validationResult.Secrets[0], strict: true);
        Assert.Equivalent(secrets[1], validationResult.Secrets[1], strict: true);
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
    public async Task InvalidToken()
    {
        await EnsureInvalidAsync(
            expectedReason: "Missing token",
            token: string.Empty
        );

        await EnsureInvalidAsync(
            expectedReason: "Invalid token: 123456",
            token: "123456"
        );

        await EnsureInvalidAsync(
            expectedReason: $"Token is expired: {TestData.ClientTokenString}",
            current: TestData.ClientToken.Timestamp + 31 * 1000
        );

        await EnsureInvalidAsync(
            expectedReason: $"Token is expired: {TestData.ClientTokenString}",
            current: TestData.ClientToken.Timestamp - 31 * 1000
        );

        var nullStore = new Mock<IStore>();
        nullStore.Setup(x => x.GetSecretAsync(It.IsAny<string>())).ReturnsAsync(() => null);
        await EnsureInvalidAsync(
            expectedReason: $"Secret is not found: {TestData.ClientSecretString}",
            store: nullStore.Object
        );

        await EnsureInvalidAsync(
            expectedReason: $"Inconsistent secret used: {SecretTypes.Client}. Request type: {ConnectionType.Server}",
            type: ConnectionType.Server
        );
    }

    [Fact]
    public async Task InvalidRelayProxyToken()
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
    public async Task LookupSecretThrows()
    {
        var errorStoreMock = new Mock<IStore>();
        errorStoreMock.Setup(x => x.GetSecretAsync(It.IsAny<string>()))
            .Throws(new Exception("Test exception"));

        var context = SetupTestContext();
        var validator = SetupValidator(store: errorStoreMock.Object);

        var validationResult = await validator.ValidateAsync(context);

        Assert.Equal(ValidationResultStatus.Unavailable, validationResult.Status);
        Assert.Equal("Secret lookup unavailable: Test exception", validationResult.Reason);
    }

    [Fact]
    public async Task ParseTokenThrows()
    {
        // A throwing ITokenValidator simulates a parsing-stage failure.
        // It must produce Failed (permanent rejection / WS 4003), never Unavailable (transient / WS 1011).
        var throwingValidator = new Mock<ITokenValidator>();
        throwingValidator
            .Setup(x => x.ValidateAsync(It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new FormatException("Simulated parse error"));

        var context = SetupTestContext();
        var validator = SetupValidator(tokenValidator: throwingValidator.Object);

        var validationResult = await validator.ValidateAsync(context);

        Assert.Equal(ValidationResultStatus.Invalid, validationResult.Status);
        Assert.Empty(validationResult.Secrets);
    }

    private static async Task EnsureInvalidAsync(
        string expectedReason,
        string? type = null,
        string? version = null,
        string? token = null,
        long? current = null,
        IStore? store = null,
        StreamingOptions? streamingOptions = null,
        IRelayProxyService? rpService = null)
    {
        var context = SetupTestContext(type, version, token);
        var validator = SetupValidator(current, store, streamingOptions, rpService);

        var validationResult = await validator.ValidateAsync(context);

        Assert.Equal(ValidationResultStatus.Invalid, validationResult.Status);
        Assert.Equal(expectedReason, validationResult.Reason);
        Assert.Empty(validationResult.Secrets);
    }

    private static RequestValidator SetupValidator(
        long? current = null,
        IStore? store = null,
        StreamingOptions? streamingOptions = null,
        IRelayProxyService? rpService = null,
        ITokenValidator? tokenValidator = null,
        ILogger<RequestValidator>? logger = null)
    {
        var mockedStore = Mock.Of<IStore>(x =>
            x.GetSecretAsync(TestData.ClientSecretString) == Task.FromResult(TestData.ClientSecret)
        );

        var validator = new RequestValidator(
            new TestSystemClock(current ?? TestData.ClientToken.Timestamp),
            store ?? mockedStore,
            streamingOptions ?? new StreamingOptions(),
            rpService ?? Mock.Of<IRelayProxyService>(),
            tokenValidator ?? new TokenValidator(),
            logger ?? NullLogger<RequestValidator>.Instance
        );

        return validator;
    }

    private static HttpContext SetupTestContext(
        string? type = null,
        string? version = null,
        string? token = null)
    {
        var httpContext = new DefaultHttpContext
        {
            Request =
            {
                QueryString = QueryString.Create([
                    new KeyValuePair<string, string?>("type", type ?? ConnectionType.Client),
                    new KeyValuePair<string, string?>("version", version ?? ConnectionVersion.V2),
                    new KeyValuePair<string, string?>("token", token ?? TestData.ClientTokenString)
                ])
            }
        };

        return httpContext;
    }
}

internal class TestSystemClock(long current) : ISystemClock
{
    public DateTimeOffset UtcNow { get; } = DateTimeOffset.FromUnixTimeMilliseconds(current);
}