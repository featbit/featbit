using Domain.Secrets;
using Domain.Shared;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Internal;
using Moq;
using Streaming.Connections;
using Streaming.Services;

namespace Streaming.UnitTests.Messages;

public class RequestValidatorTests
{
    [Fact]
    public async Task ValidateAsync_ValidClientRequest_ReturnsSecretForEnvironment()
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
        Assert.Equal(ValidationResultStatus.Valid, validationResult.Status);
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
            expectedReason: $"Invalid connection type. ct={type}",
            type: type
        );
    }

    [Theory]
    [InlineData("unknown")]
    public async Task ValidateAsync_UnsupportedProtocolVersion_FailsWithInvalidVersion(string version)
    {
        await EnsureInvalidAsync(
            expectedReason: $"Invalid protocol version. ct={ConnectionType.Client}; v={version}",
            version: version
        );
    }

    [Fact]
    public async Task ValidateAsync_EmptyToken_FailsWithInvalidToken()
    {
        await EnsureInvalidAsync(
            expectedReason: $"Missing token. ct={ConnectionType.Client}; v={ConnectionVersion.V2}",
            token: string.Empty
        );
    }

    [Fact]
    public async Task ValidateAsync_MalformedToken_FailsWithInvalidToken()
    {
        await EnsureInvalidAsync(
            expectedReason: "Invalid token format",
            token: "123456"
        );
    }

    [Theory]
    [InlineData(31000)]
    [InlineData(-31000)]
    public async Task ValidateAsync_TokenTimestampOutsideAllowedWindow_ReturnsInvalid(long timeDifferenceMs)
    {
        var timestamp = TestData.ClientToken.Timestamp;
        var current = timestamp + timeDifferenceMs;

        var tokenTime = DateTimeOffset.FromUnixTimeMilliseconds(timestamp);
        var serverTime = DateTimeOffset.FromUnixTimeMilliseconds(current);

        var expectedReason = $"Token timestamp out of range. TokenTime={tokenTime:O}({timestamp}); "
                             + $"ServerTime={serverTime:O}({current}); ServerMinusTokenMs={timeDifferenceMs}; "
                             + "Configured Streaming:TokenExpirySeconds=30s; "
                             + $"env={TestData.ClientSecret.EnvId}; ct=client; v=2";

        await EnsureInvalidAsync(expectedReason: expectedReason, current: current);
    }

    [Fact]
    public async Task ValidateAsync_SecretNotFoundInStore_FailsWithSecretNotFound()
    {
        var nullStore = new Mock<IStore>();
        nullStore.Setup(x => x.GetSecretAsync(It.IsAny<string>())).ReturnsAsync(() => null);

        await EnsureInvalidAsync(
            expectedReason: "Invalid environment secret",
            store: nullStore.Object
        );
    }

    [Fact]
    public async Task ValidateAsync_ClientSecretUsedAsServerConnection_FailsWithInconsistentSecret()
    {
        await EnsureInvalidAsync(
            expectedReason: $"Secret type mismatch. st={SecretTypes.Client}; ct={ConnectionType.Server}; v={ConnectionVersion.V2}; env={TestData.ClientSecret.EnvId}",
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
            expectedReason: "Relay proxy lookup found no server secrets",
            type: ConnectionType.RelayProxy,
            token: "rp-xxx",
            rpService: rpService.Object
        );
    }

    [Fact]
    public async Task ValidateAsync_StoreThrowsException_ReturnsUnavailable()
    {
        var errorStoreMock = new Mock<IStore>();
        errorStoreMock.Setup(x => x.GetSecretAsync(It.IsAny<string>()))
            .Throws(new Exception("Test exception"));

        var context = SetupTestContext();
        var validator = SetupValidator(store: errorStoreMock.Object);

        var validationResult = await validator.ValidateAsync(context);

        Assert.Equal(ValidationResultStatus.Unavailable, validationResult.Status);
        Assert.NotNull(validationResult.Exception);
        Assert.Equal(
            $"Secret lookup unavailable. env={TestData.ClientSecret.EnvId}; ct=client; v=2",
            validationResult.Reason
        );
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
        Assert.DoesNotContain(TestData.ClientTokenString, validationResult.Reason);
        Assert.DoesNotContain(TestData.ClientSecretString, validationResult.Reason);
        Assert.Empty(validationResult.Secrets);
    }

    private static RequestValidator SetupValidator(
        long? current = null,
        IStore? store = null,
        StreamingOptions? streamingOptions = null,
        IRelayProxyService? rpService = null)
    {
        var mockedStore = Mock.Of<IStore>(x =>
            x.GetSecretAsync(TestData.ClientSecretString) == Task.FromResult(TestData.ClientSecret)
        );

        var validator = new RequestValidator(
            new TestSystemClock(current ?? TestData.ClientToken.Timestamp),
            streamingOptions ?? new StreamingOptions(),
            rpService ?? Mock.Of<IRelayProxyService>(),
            new SecretCache(store ?? mockedStore)
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
