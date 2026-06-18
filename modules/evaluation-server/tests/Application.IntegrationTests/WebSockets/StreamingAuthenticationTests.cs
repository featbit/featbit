using System.Net.WebSockets;
using Domain.Shared;
using Streaming.Connections;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Internal;
using Moq;

namespace Application.IntegrationTests.WebSockets;

[Collection(nameof(TestApp))]
public class StreamingAuthenticationTests
{
    private readonly TestApp _app;

    public StreamingAuthenticationTests(TestApp app)
    {
        _app = app;
    }

    [Fact]
    public async Task ConnectWithValidToken_Succeeds()
    {
        // Arrange & Act
        var ws = await _app.ConnectWithTokenAsync(ConnectionType.Client);

        // Assert
        Assert.NotNull(ws);
        Assert.Equal(System.Net.WebSockets.WebSocketState.Open, ws.State);
    }

    [Fact]
    public async Task ConnectWithValidServerToken_Succeeds()
    {
        // Act
        var ws = await _app.ConnectWithTokenAsync(ConnectionType.Server);

        // Assert
        Assert.NotNull(ws);
        Assert.Equal(System.Net.WebSockets.WebSocketState.Open, ws.State);
    }

    [Fact]
    public async Task ConnectWithMissingToken_ClosesWith4003()
    {
        // Arrange
        var app = _app.WithWebHostBuilder(builder =>
        {
            builder.ConfigureTestServices(collection =>
            {
                collection.Replace(ServiceDescriptor.Singleton<ISystemClock>(new TestClock(TestData.ClientToken.Timestamp)));
            });
        });

        var client = app.Server.CreateWebSocketClient();
        var streamingUri = new Uri("http://localhost/streaming?type=client&version=2"); // Missing token

        // Act
        var ws = await client.ConnectAsync(streamingUri, CancellationToken.None);
        var close = await ws.ReceiveAsync(new byte[100], CancellationToken.None);

        // Assert
        Assert.Equal(WebSocketMessageType.Close, close.MessageType);
        Assert.Equal((WebSocketCloseStatus)4003, close.CloseStatus);
    }

    [Fact]
    public async Task ConnectWithMalformedToken_ClosesWith4003()
    {
        // Arrange
        var app = _app.WithWebHostBuilder(builder =>
        {
            builder.ConfigureTestServices(collection =>
            {
                collection.Replace(ServiceDescriptor.Singleton<ISystemClock>(new TestClock(TestData.ClientToken.Timestamp)));
            });
        });

        var client = app.Server.CreateWebSocketClient();
        var streamingUri = new Uri("http://localhost/streaming?type=client&version=2&token=malformed-token");

        // Act
        var ws = await client.ConnectAsync(streamingUri, CancellationToken.None);
        var close = await ws.ReceiveAsync(new byte[100], CancellationToken.None);

        // Assert
        Assert.Equal(WebSocketMessageType.Close, close.MessageType);
        Assert.Equal((WebSocketCloseStatus)4003, close.CloseStatus);
    }

    [Fact]
    public async Task ConnectWithExpiredToken_ClosesWith4003()
    {
        // Arrange
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

        // Act
        var ws = await client.ConnectAsync(streamingUri, CancellationToken.None);
        var close = await ws.ReceiveAsync(new byte[100], CancellationToken.None);

        // Assert
        Assert.Equal(WebSocketMessageType.Close, close.MessageType);
        Assert.Equal((WebSocketCloseStatus)4003, close.CloseStatus);
    }

    [Fact]
    public async Task ConnectWithInvalidType_ClosesWith4003()
    {
        // Arrange
        var app = _app.WithWebHostBuilder(builder =>
        {
            builder.ConfigureTestServices(collection =>
            {
                collection.Replace(ServiceDescriptor.Singleton<ISystemClock>(new TestClock(TestData.ClientToken.Timestamp)));
            });
        });

        var client = app.Server.CreateWebSocketClient();
        var streamingUri = new Uri($"http://localhost/streaming?type=invalid&version=2&token={TestData.ClientTokenString}");

        // Act
        var ws = await client.ConnectAsync(streamingUri, CancellationToken.None);
        var close = await ws.ReceiveAsync(new byte[100], CancellationToken.None);

        // Assert
        Assert.Equal(WebSocketMessageType.Close, close.MessageType);
        Assert.Equal((WebSocketCloseStatus)4003, close.CloseStatus);
    }

    [Fact]
    public async Task ConnectWithInvalidVersion_ClosesWith4003()
    {
        // Arrange
        var app = _app.WithWebHostBuilder(builder =>
        {
            builder.ConfigureTestServices(collection =>
            {
                collection.Replace(ServiceDescriptor.Singleton<ISystemClock>(new TestClock(TestData.ClientToken.Timestamp)));
            });
        });

        var client = app.Server.CreateWebSocketClient();
        var streamingUri = new Uri($"http://localhost/streaming?type=client&version=999&token={TestData.ClientTokenString}");

        // Act
        var ws = await client.ConnectAsync(streamingUri, CancellationToken.None);
        var close = await ws.ReceiveAsync(new byte[100], CancellationToken.None);

        // Assert
        Assert.Equal(WebSocketMessageType.Close, close.MessageType);
        Assert.Equal((WebSocketCloseStatus)4003, close.CloseStatus);
    }

    [Fact]
    public async Task InvalidToken_AcceptsThenClosesWith4003()
    {
        // Arrange
        var app = _app.WithWebHostBuilder(builder =>
        {
            builder.ConfigureTestServices(collection =>
            {
                collection.Replace(ServiceDescriptor.Singleton<ISystemClock>(new TestClock(TestData.ClientToken.Timestamp)));
            });
        });

        var client = app.Server.CreateWebSocketClient();
        var streamingUri = new Uri("http://localhost/streaming?type=client&version=2&token=XXX"); // Invalid token

        // Act
        var ws = await client.ConnectAsync(streamingUri, CancellationToken.None);
        var close = await ws.ReceiveAsync(new byte[100], CancellationToken.None);

        // Assert
        Assert.Equal(WebSocketMessageType.Close, close.MessageType);
        Assert.Equal((WebSocketCloseStatus)4003, close.CloseStatus);
    }

    [Fact]
    public async Task StoreUnavailable_AcceptsThenClosesWithNon4003()
    {
        // Arrange: a store that throws on secret lookup simulates a transient outage,
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

        // Act
        var ws = await client.ConnectAsync(streamingUri, CancellationToken.None);
        var close = await ws.ReceiveAsync(new byte[100], CancellationToken.None);

        // Assert
        Assert.Equal(WebSocketMessageType.Close, close.MessageType);
        Assert.NotEqual((WebSocketCloseStatus)4003, close.CloseStatus);
        Assert.Equal(WebSocketCloseStatus.InternalServerError, close.CloseStatus);
    }
}
