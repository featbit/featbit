using System.Net.WebSockets;

namespace Application.IntegrationTests.WebSockets;

// TODO: Add Asserts
public class ProcessMessageTests : IClassFixture<TestApp>
{
    private readonly StreamingTestApp _app;

    public ProcessMessageTests(TestApp app)
    {
        _app = new StreamingTestApp(app);
    }

    [Fact]
    public async Task ProcessEmptyMessage()
    {
        var ws = await _app.ConnectWithTokenAsync();
        await ws.SendAsync(ArraySegment<byte>.Empty, WebSocketMessageType.Text, true, CancellationToken.None);
    }

    [Fact]
    public async Task ProcessInconsistentMessageFragment()
    {
        using var ws = await _app.ConnectWithTokenAsync();

        await ws.SendAsync(new byte[] { 0x0, 0x1, 0x2 }, WebSocketMessageType.Text, false, CancellationToken.None);
        await ws.SendAsync(new byte[] { 0x3, 0x4 }, WebSocketMessageType.Text, false, CancellationToken.None);
        await ws.SendAsync(new byte[] { 0x5, 0x6, 0x7 }, WebSocketMessageType.Text, false, CancellationToken.None);
        await ws.SendAsync(new byte[] { 0x8 }, WebSocketMessageType.Binary, true, CancellationToken.None);
    }

    [Fact]
    public async Task ProcessTooManyMessageFragment()
    {
        using var ws = await _app.ConnectWithTokenAsync();

        const int maxMessageFragment = 8;
        for (byte i = 0; i < maxMessageFragment; i++)
        {
            await ws.SendAsync(new[] { i }, WebSocketMessageType.Text, false, CancellationToken.None);
        }
        
        await ws.SendAsync(new byte[] { 0x8 }, WebSocketMessageType.Text, true, CancellationToken.None);
    }
}