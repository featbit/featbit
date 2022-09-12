using System.Net.WebSockets;
using Domain.WebSockets;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Internal;
using TestBase;

namespace Application.IntegrationTests.WebSockets;

public class StreamingTestApp
{
    private readonly TestApp _app;

    public StreamingTestApp(TestApp app)
    {
        _app = app;
    }

    public async Task<WebSocket> ConnectAsync(long timestamp = 0, string queryString = "")
    {
        var streamingApp = _app.WithWebHostBuilder(builder => builder.ConfigureTestServices(collection =>
        {
            collection.Replace(ServiceDescriptor.Singleton<ISystemClock>(new TestClock(timestamp)));
            collection.Replace(ServiceDescriptor.Scoped(_ => GetConnectionHandler()));
        }));

        var client = streamingApp.Server.CreateWebSocketClient();
        var streamingUri = new Uri($"http://localhost/streaming{queryString}");

        var ws = await client.ConnectAsync(streamingUri, CancellationToken.None);
        return ws;
    }

    public async Task<WebSocket> ConnectWithTokenAsync()
    {
        const string token =
            "QPXBHMWIxLWQ0NWUtNCUyMDIyMDgwMjA2MzUzNl9fMTYxX18yMDRQQBDDBUQXBHXXQDfXzQyMV9fZGVmYXVsdF84ZDBmZQ";

        const long tokenCreatedAt = 1661907157706;

        return await ConnectAsync(tokenCreatedAt, $"?type=client&version=2&token={token}");
    }

    ConnectionHandler GetConnectionHandler()
    {
        var manager = new ConnectionManager(new InMemoryFakeLogger<ConnectionManager>());
        var handler = new ConnectionHandler(manager, new InMemoryFakeLogger<ConnectionHandler>())
        {
            CancellationToken = CancellationToken.None
        };

        return handler;
    }
}