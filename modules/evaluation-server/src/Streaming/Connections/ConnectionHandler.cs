using System.Net.WebSockets;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Streaming.Messages;

namespace Streaming.Connections;

public partial class ConnectionHandler : IConnectionHandler
{
    private readonly IConnectionManager _connectionManager;
    private readonly IEnumerable<IMessageHandler> _messageHandlers;
    private readonly ILogger<ConnectionHandler> _logger;
    private readonly MessageReader _messageReader;

    // message json format
    // { messageType: "", data: { } }
    private const string MessageTypePropertyName = "messageType";
    private const string DataPropertyName = "data";

    public ConnectionHandler(
        IConnectionManager connectionManager,
        IEnumerable<IMessageHandler> messageHandlers,
        ILogger<ConnectionHandler> logger)
    {
        _connectionManager = connectionManager;
        _messageHandlers = messageHandlers;

        _messageReader = new MessageReader();
        _messageReader.OnMessageAsync += OnMessageAsync;
        _messageReader.OnError += OnMessageError;

        _logger = logger;
    }

    public async Task OnConnectedAsync(Connection connection, CancellationToken cancellationToken)
    {
        // add connection
        _connectionManager.Add(connection);

        // start listen websocket message
        var ws = connection.WebSocket;
        while (ws.State == WebSocketState.Open && !cancellationToken.IsCancellationRequested)
        {
            try
            {
                await _messageReader.StartAsync(connection, cancellationToken);
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
                Log.ErrorProcessMessage(_logger, connection.Id, ex.Message);
            }
        }

        // close connection
        await connection.CloseAsync(
            ws.CloseStatus ?? WebSocketCloseStatus.NormalClosure,
            ws.CloseStatusDescription ?? string.Empty,
            DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
        );

        // remove connection
        _connectionManager.Remove(connection);
    }

    public async Task OnMessageAsync(Connection connection, Message message, CancellationToken cancellationToken)
    {
        if (message.Type == WebSocketMessageType.Close)
        {
            Log.ReceiveCloseMessage(_logger, connection.Id);
            return;
        }

        if (message.Bytes.IsEmpty)
        {
            Log.ReceiveEmptyMessage(_logger, connection.Id);
            return;
        }

        // currently we only process text messages
        if (message.Type == WebSocketMessageType.Text)
        {
            await HandleMessageAsync(connection, message, cancellationToken);
        }
    }

    public void OnMessageError(Connection connection, string error)
    {
        Log.ErrorReadMessage(_logger, connection.Id, error);
    }

    public async Task HandleMessageAsync(Connection connection, Message message, CancellationToken token)
    {
        var json = message.Bytes;

        try
        {
            using var document = JsonDocument.Parse(json);

            var root = document.RootElement;
            if (!root.TryGetProperty(MessageTypePropertyName, out var messageTypeElement) ||
                !root.TryGetProperty(DataPropertyName, out var dataElement))
            {
                return;
            }

            var messageType = messageTypeElement.GetString();

            var handler = _messageHandlers.FirstOrDefault(x => x.Type == messageType);
            if (handler == null)
            {
                Log.CannotFindMessageHandler(_logger, connection.Id, messageType ?? "");
                return;
            }

            var ctx = new MessageContext(connection, message, dataElement, token);
            await handler.HandleAsync(ctx);
        }
        catch (JsonException ex)
        {
            // ignore invalid json
            Log.ReceiveInvalidMessage(_logger, connection.Id, ex);
        }
        catch (Exception ex)
        {
            // error when handle message
            Log.ErrorHandleMessage(_logger, connection.Id, ex);
        }
    }
}