using System.Net.WebSockets;
using Domain.Shared;
using Streaming.Connections;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Internal;
using Moq;

namespace Application.IntegrationTests.WebSockets;

[Trait("Category", "Host")]
[Collection(nameof(TestApp))]
[Trait("Category", "Integration")]
public class AuthenticationTests
{
    private readonly TestApp _app;

    public AuthenticationTests(TestApp app)
    {
        _app = app;
    }

    [Theory]
    [InlineData(ConnectionType.Client)]
    [InlineData(ConnectionType.Server)]
    public async Task ConnectAsync_WithValidToken_Succeeds(string type)
    {
        var ws = await _app.ConnectWithTokenAsync(type);

        Assert.NotNull(ws);
        Assert.Equal(WebSocketState.Open, ws.State);
    }

    [Fact]
    public async Task ConnectAsync_WithoutToken_ClosesWith4003()
    {
        var ws = await _app.ConnectAsync(TestData.ClientToken.Timestamp, "?type=client&version=2");
        var close = await ws.ReceiveAsync(new byte[100], CancellationToken.None);

        Assert.Equal(WebSocketMessageType.Close, close.MessageType);
        Assert.Equal((WebSocketCloseStatus)4003, close.CloseStatus);
    }

    [Fact]
    public async Task ConnectAsync_WithMalformedToken_ClosesWith4003()
    {
        var ws = await _app.ConnectAsync(TestData.ClientToken.Timestamp, "?type=client&version=2&token=malformed-token");
        var close = await ws.ReceiveAsync(new byte[100], CancellationToken.None);

        Assert.Equal(WebSocketMessageType.Close, close.MessageType);
        Assert.Equal((WebSocketCloseStatus)4003, close.CloseStatus);
    }

    [Fact]
    public async Task ConnectAsync_WithExpiredToken_ClosesWith4003()
    {
        var expirySeconds = 30; // Default from config
        var tokenAge = expirySeconds + 1; // Token is 1 second past expiry
        var expiredTokenTime = TestData.ClientToken.Timestamp - (tokenAge * 1000);

        var app = _app.WithWebHostBuilder(builder =>
        {
            builder.UseSetting("Streaming:TokenExpirySeconds", expirySeconds.ToString());
            builder.ConfigureTestServices(collection =>
            {
                collection.Replace(ServiceDescriptor.Singleton<ISystemClock>(new TestClock(expiredTokenTime)));
            });
        });

        var client = app.Server.CreateWebSocketClient();
        var streamingUri = new Uri($"http://localhost/streaming?type=client&version=2&token={TestData.ClientTokenString}");

        var ws = await client.ConnectAsync(streamingUri, CancellationToken.None);
        var close = await ws.ReceiveAsync(new byte[100], CancellationToken.None);

        Assert.Equal(WebSocketMessageType.Close, close.MessageType);
        Assert.Equal((WebSocketCloseStatus)4003, close.CloseStatus);
    }

    [Fact]
    public async Task ConnectAsync_WithInconsistentSecretType_ClosesWith4003()
    {
        var ws = await _app.ConnectAsync(TestData.ClientToken.Timestamp, $"?type=server&version=2&token={TestData.ClientTokenString}");
        var close = await ws.ReceiveAsync(new byte[100], CancellationToken.None);

        Assert.Equal(WebSocketMessageType.Close, close.MessageType);
        Assert.Equal((WebSocketCloseStatus)4003, close.CloseStatus);
    }

    [Fact]
    public async Task ConnectAsync_WithUnsupportedVersion_ClosesWith4003()
    {
        var ws = await _app.ConnectAsync(TestData.ClientToken.Timestamp, $"?type=client&version=999&token={TestData.ClientTokenString}");
        var close = await ws.ReceiveAsync(new byte[100], CancellationToken.None);

        Assert.Equal(WebSocketMessageType.Close, close.MessageType);
        Assert.Equal((WebSocketCloseStatus)4003, close.CloseStatus);
    }

    [Fact]
    public async Task ConnectAsync_WithUnparseableToken_AcceptsThenClosesWith4003()
    {
        var ws = await _app.ConnectAsync(TestData.ClientToken.Timestamp, "?type=client&version=2&token=XXX");
        var close = await ws.ReceiveAsync(new byte[100], CancellationToken.None);

        Assert.Equal(WebSocketMessageType.Close, close.MessageType);
        Assert.Equal((WebSocketCloseStatus)4003, close.CloseStatus);
    }

    [Fact]
    public async Task ConnectAsync_StoreUnavailable_AcceptsThenClosesWithInternalServerError()
    {
        // A store that throws on secret lookup simulates a transient outage,
        // which the validator maps to Unavailable. The connection must be accepted and
        // closed with a non-4003 status so SDKs treat it as transient and reconnect.
        var faultyStore = new Mock<IStore>();
        faultyStore
            .Setup(store => store.GetSecretAsync(It.IsAny<string>()))
            .ThrowsAsync(new Exception("store outage"));

        var app = _app.WithWebHostBuilder(builder =>
        {
            builder.ConfigureTestServices(collection =>
            {
                collection.Replace(ServiceDescriptor.Singleton<ISystemClock>(new TestClock(TestData.ClientToken.Timestamp)));
                collection.Replace(ServiceDescriptor.Singleton<IStore>(faultyStore.Object));
            });
        });

        var client = app.Server.CreateWebSocketClient();
        var streamingUri = new Uri($"http://localhost/streaming?type=client&version=2&token={TestData.ClientTokenString}");

        var ws = await client.ConnectAsync(streamingUri, CancellationToken.None);
        var close = await ws.ReceiveAsync(new byte[100], CancellationToken.None);

        Assert.Equal(WebSocketMessageType.Close, close.MessageType);
        Assert.NotEqual((WebSocketCloseStatus)4003, close.CloseStatus);
        Assert.Equal(WebSocketCloseStatus.InternalServerError, close.CloseStatus);
    }
}
