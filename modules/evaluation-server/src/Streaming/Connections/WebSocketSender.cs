using System.Net.WebSockets;
using System.Runtime.CompilerServices;
using System.Threading.Channels;

namespace Streaming.Connections;

// Relay-proxy mappings and protocol replies must use the same writer as change notifications.
internal sealed class WebSocketSender
{
    private static readonly ConditionalWeakTable<WebSocket, Lazy<WebSocketSender>> Senders = new();
    private readonly WebSocket _socket;
    private readonly Channel<PendingSend> _queue;
    private readonly CancellationTokenSource _stop = new();
    private readonly TimeProvider _timeProvider;
    private readonly TimeSpan _timeout;
    private readonly object _gate = new();
    private readonly Task _worker;
    private Exception? _failure;
    private bool _sending;

    internal static WebSocketSender For(WebSocket socket) =>
        Senders.GetValue(socket, key => new Lazy<WebSocketSender>(() => new WebSocketSender(key))).Value;

    internal WebSocketSender(WebSocket socket, TimeProvider? timeProvider = null, int capacity = 32,
        TimeSpan? timeout = null)
    {
        _socket = socket;
        _timeProvider = timeProvider ?? TimeProvider.System;
        _timeout = timeout ?? TimeSpan.FromSeconds(10);
        _queue = Channel.CreateBounded<PendingSend>(new BoundedChannelOptions(capacity)
        {
            SingleReader = true,
            FullMode = BoundedChannelFullMode.Wait,
            AllowSynchronousContinuations = false
        });
        _worker = Task.Run(ProcessAsync);
    }

    internal Task SendAsync(ReadOnlyMemory<byte> bytes, CancellationToken token)
    {
        var completion = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        Enqueue(new PendingSend(bytes.ToArray(), token, completion, null));
        return completion.Task;
    }

    internal void Enqueue(ReadOnlyMemory<byte> bytes, CancellationToken token, Action<Exception> onFailure) =>
        Enqueue(new PendingSend(bytes.ToArray(), token, null, onFailure));

    private void Enqueue(PendingSend send)
    {
        if (_queue.Writer.TryWrite(send))
            return;

        Stop(new IOException("WebSocket send queue is full or closed; reconnect for a full sync."), true);
        send.Fail(_failure!);
    }

    internal void Stop() => Stop(new OperationCanceledException("WebSocket connection closed."), false);

    internal async Task CompleteAsync()
    {
        Stop();
        await _worker;
    }

    private void Stop(Exception error, bool abort)
    {
        lock (_gate)
        {
            if (_failure is not null)
                return;
            _failure = error;
            _queue.Writer.TryComplete();
            if (abort || _sending)
                _socket.Abort();
            _stop.Cancel();
        }
    }

    private async Task ProcessAsync()
    {
        try
        {
            await foreach (var send in _queue.Reader.ReadAllAsync(_stop.Token))
            {
                try
                {
                    lock (_gate)
                    {
                        if (_failure is not null)
                            throw _failure;
                        send.Token.ThrowIfCancellationRequested();
                        _sending = true;
                    }

                    using var timeout = new CancellationTokenSource(_timeout, _timeProvider);
                    using var linked = CancellationTokenSource.CreateLinkedTokenSource(
                        send.Token, timeout.Token, _stop.Token);
                    // WaitAsync also bounds a transport that does not promptly observe cancellation.
                    await _socket.SendAsync(new ArraySegment<byte>(send.Bytes), WebSocketMessageType.Text, true, linked.Token)
                        .WaitAsync(linked.Token);
                }
                catch (Exception error)
                {
                    Stop(error, true);
                    send.Fail(_failure!);
                }
                finally
                {
                    lock (_gate) _sending = false;
                }
                send.Completion?.TrySetResult();
            }
        }
        catch (OperationCanceledException) when (_stop.IsCancellationRequested)
        {
        }
        finally
        {
            while (_queue.Reader.TryRead(out var send))
                send.Fail(_failure!);
        }
    }

    private sealed record PendingSend(byte[] Bytes, CancellationToken Token,
        TaskCompletionSource? Completion, Action<Exception>? OnFailure)
    {
        internal void Fail(Exception error)
        {
            Completion?.TrySetException(error);
            OnFailure?.Invoke(error);
        }
    }
}
