using System.Net.WebSockets;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Internal;

namespace Application.IntegrationTests.Streaming;

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
            var descriptor = ServiceDescriptor.Singleton<ISystemClock>(new TestClock(timestamp));
            collection.Replace(descriptor);
        }));

        var client = streamingApp.Server.CreateWebSocketClient();
        var streamingUri = new Uri($"http://localhost/streaming{queryString}");

        var ws = await client.ConnectAsync(streamingUri, CancellationToken.None);
        return ws;
    }
}