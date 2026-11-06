using System.Net.WebSockets;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Time.Testing;
using Moq;
using Streaming.Connections;
using Streaming.Protocol;
using Domain.Shared;

namespace Streaming.UnitTests.Connections;

public class WebSocketSenderTests
{
    private static readonly TimeSpan TestTimeout = TimeSpan.FromSeconds(5);

    [Fact]
    public async Task SendAsync_SharedSocket_SerializesRelayMappingsAndProtocolReplies()
    {
        var started = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var release = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var calls = new List<string>();
        var socket = CreateSocket((bytes, _) =>
        {
            calls.Add(System.Text.Encoding.UTF8.GetString(bytes));
            started.TrySetResult();
            return calls.Count == 1 ? release.Task : Task.CompletedTask;
        });
        var first = new Connection(socket.Object, new Secret(SecretTypes.Server, "p", Guid.NewGuid(), "a"));
        var second = new Connection(socket.Object, new Secret(SecretTypes.Server, "p", Guid.NewGuid(), "b"));
        var sender = WebSocketSender.For(socket.Object);

        var one = first.SendAsync(new ServerMessage("first", 1), CancellationToken.None);
        await started.Task.WaitAsync(TestTimeout);
        var two = second.SendAsync(new ServerMessage("second", 2), CancellationToken.None);
        using var services = new ServiceCollection().AddSingleton(new Streaming.StreamingOptions()).BuildServiceProvider();
        var context = new DefaultConnectionContext(socket.Object, new DefaultHttpContext { RequestServices = services });
        var reply = context.SendAsync("reply"u8.ToArray(), CancellationToken.None);
        Assert.Single(calls);
        release.TrySetResult();
        await Task.WhenAll(one, two, reply).WaitAsync(TestTimeout);
        await sender.CompleteAsync();

        Assert.Equal(3, calls.Count);
        Assert.Contains("first", calls[0]);
        Assert.Contains("second", calls[1]);
        Assert.Equal("reply", calls[2]);
    }

    [Fact]
    public async Task SendAsync_UnresponsiveTransport_DeadlineAbortsAndFailsQueuedSends()
    {
        var time = new FakeTimeProvider();
        var started = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var blocked = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var socket = CreateSocket((_, _) => { started.TrySetResult(); return blocked.Task; });
        var sender = new WebSocketSender(socket.Object, time);

        var first = sender.SendAsync(new byte[] { 1 }, CancellationToken.None);
        await started.Task.WaitAsync(TestTimeout);
        var queued = sender.SendAsync(new byte[] { 2 }, CancellationToken.None);
        time.Advance(TimeSpan.FromSeconds(10));

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => first.WaitAsync(TestTimeout));
        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => queued.WaitAsync(TestTimeout));
        await sender.CompleteAsync().WaitAsync(TestTimeout);
        socket.Verify(x => x.Abort(), Times.Once);
        VerifySendCount(socket, 1);
        blocked.TrySetResult();
    }

    [Fact]
    public async Task SendAsync_QueueOverflow_AbortsForFullResyncWithoutDroppingSilently()
    {
        var started = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var blocked = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var socket = CreateSocket((_, _) => { started.TrySetResult(); return blocked.Task; });
        var sender = new WebSocketSender(socket.Object, capacity: 1);
        var first = sender.SendAsync(new byte[] { 1 }, CancellationToken.None);
        await started.Task.WaitAsync(TestTimeout);
        var second = sender.SendAsync(new byte[] { 2 }, CancellationToken.None);

        var overflow = sender.SendAsync(new byte[] { 3 }, CancellationToken.None);

        foreach (var pending in new[] { first, second, overflow })
            await Assert.ThrowsAsync<IOException>(() => pending.WaitAsync(TestTimeout));
        await sender.CompleteAsync().WaitAsync(TestTimeout);
        socket.Verify(x => x.Abort(), Times.Once);
        VerifySendCount(socket, 1);
        blocked.TrySetResult();
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task SendAsync_CloseOrCallerCancellation_StopsWorkerAndRejectsFurtherWrites(bool cancelCaller)
    {
        var started = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var blocked = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var socket = CreateSocket((_, _) => { started.TrySetResult(); return blocked.Task; });
        var sender = new WebSocketSender(socket.Object);
        using var cancellation = new CancellationTokenSource();
        var send = sender.SendAsync(new byte[] { 1 }, cancellation.Token);
        await started.Task.WaitAsync(TestTimeout);

        if (cancelCaller) cancellation.Cancel();
        else sender.Stop();

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => send.WaitAsync(TestTimeout));
        await sender.CompleteAsync().WaitAsync(TestTimeout);
        await Assert.ThrowsAnyAsync<OperationCanceledException>(() =>
            sender.SendAsync(new byte[] { 2 }, CancellationToken.None));
        socket.Verify(x => x.Abort(), Times.Once);
        VerifySendCount(socket, 1);
        blocked.TrySetResult();
    }

    [Fact]
    public async Task SendAsync_FailureLoggerThrows_StillFailsAllWaitingSendsAndStopsWorker()
    {
        var time = new FakeTimeProvider();
        var started = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var blocked = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var socket = CreateSocket((_, _) => { started.TrySetResult(); return blocked.Task; });
        var sender = new WebSocketSender(socket.Object, time);
        var first = sender.SendAsync(new byte[] { 1 }, CancellationToken.None);
        await started.Task.WaitAsync(TestTimeout);
        sender.Enqueue(new byte[] { 2 }, CancellationToken.None, _ => throw new IOException("logger failed"));
        var last = sender.SendAsync(new byte[] { 3 }, CancellationToken.None);

        time.Advance(TimeSpan.FromSeconds(10));

        try
        {
            await Assert.ThrowsAnyAsync<OperationCanceledException>(() => first.WaitAsync(TestTimeout));
            await Assert.ThrowsAnyAsync<OperationCanceledException>(() => last.WaitAsync(TestTimeout));
            await sender.CompleteAsync().WaitAsync(TestTimeout);
        }
        finally
        {
            blocked.TrySetResult();
        }
        socket.Verify(x => x.Abort(), Times.Once);
    }

    [Fact]
    public async Task SendAsync_TransportFailure_AbortsAndPreservesFailure()
    {
        var failure = new WebSocketException("write failed");
        var socket = CreateSocket((_, _) => Task.FromException(failure));
        var sender = new WebSocketSender(socket.Object);

        var result = await Assert.ThrowsAsync<WebSocketException>(() =>
            sender.SendAsync(new byte[] { 1 }, CancellationToken.None).WaitAsync(TestTimeout));
        await sender.CompleteAsync();

        Assert.Same(failure, result);
        socket.Verify(x => x.Abort(), Times.Once);
    }

    private static Mock<WebSocket> CreateSocket(Func<ArraySegment<byte>, CancellationToken, Task> send)
    {
        var socket = new Mock<WebSocket>();
        socket.SetupGet(x => x.State).Returns(WebSocketState.Open);
        socket.Setup(x => x.SendAsync(It.IsAny<ArraySegment<byte>>(), WebSocketMessageType.Text, true,
            It.IsAny<CancellationToken>())).Returns((ArraySegment<byte> bytes, WebSocketMessageType _, bool _,
            CancellationToken token) => send(bytes, token));
        return socket;
    }

    private static void VerifySendCount(Mock<WebSocket> socket, int count) =>
        socket.Verify(x => x.SendAsync(It.IsAny<ArraySegment<byte>>(), WebSocketMessageType.Text, true,
            It.IsAny<CancellationToken>()), Times.Exactly(count));
}
