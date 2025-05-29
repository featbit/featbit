using System.Buffers;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Streaming.Connections;

namespace Streaming.Messages;

public sealed partial class MessageDispatcher
{
    // JSON message format: {"messageType": "<type>", "data": <object>}
    private const string MessageTypePropertyName = "messageType";
    private const string DataPropertyName = "data";

    // Default buffer size for receiving messages (in bytes)
    private const int DefaultBufferSize = 4 * 1024;

    // Maximum number of fragments for a message, for most of the time messages should be single-fragment
    private const int MaxMessageFragment = 4;

    private readonly Dictionary<string, IMessageHandler> _handlers;
    private readonly ILogger<MessageDispatcher> _logger;

    public MessageDispatcher(IEnumerable<IMessageHandler> handlers, ILogger<MessageDispatcher> logger)
    {
        _handlers = handlers.ToDictionary(handler => handler.Type, StringComparer.OrdinalIgnoreCase);
        _logger = logger;
    }

    public async Task DispatchAsync(ConnectionContext connection, CancellationToken token)
    {
        var ws = connection.WebSocket;

        while (!token.IsCancellationRequested && ws.State == WebSocketState.Open)
        {
            try
            {
                await DispatchCoreAsync(connection, token);
            }
            catch (WebSocketException e) when (e.WebSocketErrorCode == WebSocketError.ConnectionClosedPrematurely)
            {
                ws.Abort();
            }
            catch (OperationCanceledException)
            {
                // ignore
            }
            catch (Exception ex)
            {
                Log.ErrorDispatchMessage(_logger, connection, ex);
            }
        }
    }

    private async Task DispatchCoreAsync(ConnectionContext connection, CancellationToken token)
    {
        var ws = connection.WebSocket;

        // Do a 0 byte read so that idle connections don't allocate a buffer when waiting for a read
        var result = await ws.ReceiveAsync(Memory<byte>.Empty, token);
        if (result.MessageType == WebSocketMessageType.Close)
        {
            Log.ReceivedClose(_logger, connection);
            return;
        }

        // empty message
        if (result.EndOfMessage)
        {
            Log.ReceivedEmpty(_logger, connection);
            return;
        }

        var buffer = ArrayPool<byte>.Shared.Rent(DefaultBufferSize);

        try
        {
            // Need to check again for netcoreapp3.0 and later because a close can happen between a 0-byte read and the actual read
            var receiveResult = await ws.ReceiveAsync(buffer, token);
            if (receiveResult.MessageType == WebSocketMessageType.Close)
            {
                Log.ReceivedClose(_logger, connection);
                return;
            }

            // single-fragment message
            if (receiveResult.EndOfMessage)
            {
                // handle the message
                var message = buffer.AsMemory()[..receiveResult.Count];
                await HandleMessageAsync(connection, message, token);
            }
            else
            {
                // multi-fragment message, this should be a rare case
                var fragments = new MessageFragments();
                fragments.Append(buffer, receiveResult.Count);
                try
                {
                    do
                    {
                        receiveResult = await ws.ReceiveAsync(buffer, token);
                        if (receiveResult.MessageType == WebSocketMessageType.Close)
                        {
                            Log.ReceivedClose(_logger, connection);
                            return;
                        }

                        fragments.Append(buffer, receiveResult.Count);
                    } while (fragments.Count < MaxMessageFragment && !receiveResult.EndOfMessage);

                    if (!receiveResult.EndOfMessage)
                    {
                        Log.TooManyFragments(_logger, connection);
                        return;
                    }

                    // handle the message
                    var message = fragments.GetBytes();
                    await HandleMessageAsync(connection, message, token);
                }
                finally
                {
                    fragments.Free();
                }
            }
        }
        finally
        {
            ArrayPool<byte>.Shared.Return(buffer);
        }
    }

    private async Task HandleMessageAsync(ConnectionContext connection, Memory<byte> bytes, CancellationToken token)
    {
        try
        {
            using var message = JsonDocument.Parse(bytes);

            var root = message.RootElement;
            if (!root.TryGetProperty(MessageTypePropertyName, out var messageTypeElement) ||
                !root.TryGetProperty(DataPropertyName, out var dataElement))
            {
                return;
            }

            var messageType = messageTypeElement.GetString() ?? string.Empty;
            if (!_handlers.TryGetValue(messageType, out var handler))
            {
                Log.NoHandlerFor(_logger, messageType, connection);
                return;
            }

            var ctx = new MessageContext(connection, dataElement, token);
            await handler.HandleAsync(ctx);
        }
        catch (JsonException)
        {
            Log.ReceivedInvalid(_logger, Encoding.UTF8.GetString(bytes.Span), connection);
        }
        catch (Exception ex)
        {
            Log.ErrorHandleMessage(_logger, Encoding.UTF8.GetString(bytes.Span), connection, ex);
        }
    }
}