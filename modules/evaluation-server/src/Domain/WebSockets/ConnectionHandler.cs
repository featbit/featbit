using System.Net.WebSockets;
using Microsoft.Extensions.Logging;

namespace Domain.WebSockets;

public partial class ConnectionHandler : IConnectionHandler
{
    private readonly IConnectionManager _connectionManager;
    private readonly IMessageReader _messageReader;
    private readonly ILogger<ConnectionHandler> _logger;

    public ConnectionHandler(
        IConnectionManager connectionManager,
        IMessageReader messageReader,
        ILogger<ConnectionHandler> logger)
    {
        _connectionManager = connectionManager;

        _messageReader = messageReader;
        _messageReader.OnMessageAsync += OnMessageAsync;
        _messageReader.OnError += OnError;

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
            // do echo
            await connection.SendAsync(message, cancellationToken);
        }
    }

    public void OnError(Connection connection, string error)
    {
        Log.ErrorReadMessage(_logger, connection.Id, error);
    }
}