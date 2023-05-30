using System.Buffers;
using System.Net.WebSockets;
using Streaming.Connections;

namespace Streaming.Messages;

public class MessageReader
{
    private const int DefaultBufferSize = 4 * 1024;
    private const int MaxMessageFragment = 8;

    public event Func<Connection, Message, CancellationToken, Task>? OnMessageAsync;

    public event Action<Connection, string>? OnError;

    public async Task StartAsync(Connection connection, CancellationToken token)
    {
        async Task RaiseMessageEvent(Message message)
        {
            await (OnMessageAsync?.Invoke(connection, message, token) ?? Task.CompletedTask);
        }

        void RaiseErrorEvent(string error)
        {
            OnError?.Invoke(connection, error);
        }

        var ws = connection.WebSocket;

        // Do a 0 byte read so that idle connections don't allocate a buffer when waiting for a read
        var result = await ws.ReceiveAsync(Memory<byte>.Empty, token);
        if (result.MessageType == WebSocketMessageType.Close)
        {
            await RaiseMessageEvent(Message.Close);
            return;
        }

        // empty message
        if (result.EndOfMessage)
        {
            await RaiseMessageEvent(Message.Empty(result.MessageType));
            return;
        }

        var buffer = ArrayPool<byte>.Shared.Rent(DefaultBufferSize);
        var fragments = new MessageFragments();
        try
        {
            // Need to check again for netcoreapp3.0 and later because a close can happen between a 0-byte read and the actual read
            var receiveResult = await ws.ReceiveAsync(buffer, token);
            if (receiveResult.MessageType == WebSocketMessageType.Close)
            {
                await RaiseMessageEvent(Message.Close);
                return;
            }

            if (receiveResult.EndOfMessage)
            {
                // single-fragment message
                var single = new Message(buffer.AsMemory()[..receiveResult.Count], receiveResult.MessageType);
                await RaiseMessageEvent(single);
                return;
            }

            // multi-fragment message
            fragments.Append(buffer, receiveResult.Count);

            var originalMessageType = receiveResult.MessageType;
            do
            {
                receiveResult = await ws.ReceiveAsync(buffer, token);
                if (receiveResult.MessageType == WebSocketMessageType.Close)
                {
                    await RaiseMessageEvent(Message.Close);
                    return;
                }

                if (receiveResult.MessageType != originalMessageType)
                {
                    RaiseErrorEvent("inconsistent message type between fragments");
                    return;
                }

                fragments.Append(buffer, receiveResult.Count);
            } while (fragments.Count < MaxMessageFragment && !receiveResult.EndOfMessage);

            if (!receiveResult.EndOfMessage)
            {
                RaiseErrorEvent("too many message fragment");
                return;
            }

            var fragmented = new Message(fragments.GetBytes(), receiveResult.MessageType);
            await RaiseMessageEvent(fragmented);
        }
        finally
        {
            // free rented resources
            ArrayPool<byte>.Shared.Return(buffer);
            fragments.Free();
        }
    }
}