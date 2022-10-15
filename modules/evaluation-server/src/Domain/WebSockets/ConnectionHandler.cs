using System.Net.WebSockets;
using Microsoft.Extensions.Logging;

namespace Domain.WebSockets;

public partial class ConnectionHandler
{
    private readonly ConnectionManager _connectionManager;
    private readonly MessageProcessor _messageProcessor;
    private readonly ILogger<ConnectionHandler> _logger;

    private CancellationToken? _cancellationToken;
    public CancellationToken CancellationToken
    {
        get => _cancellationToken ?? CancellationToken.None;
        set => _cancellationToken ??= value;
    }

    public ConnectionHandler(ConnectionManager connectionManager, ILogger<ConnectionHandler> logger)
    {
        _connectionManager = connectionManager;

        _messageProcessor = new MessageProcessor();
        _messageProcessor.OnMessageAsync += OnMessageAsync;
        _messageProcessor.OnError += OnError;

        _logger = logger;
    }

    public async Task ProcessAsync(Connection connection)
    {
        // register connection
        _connectionManager.Register(connection);

        // process websocket message
        var ws = connection.WebSocket;
        while (ws.State == WebSocketState.Open && !CancellationToken.IsCancellationRequested)
        {
            try
            {
                await _messageProcessor.StartAsync(connection, CancellationToken);
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

        await _connectionManager.RemoveAsync(
            connection,
            ws.CloseStatus ?? WebSocketCloseStatus.NormalClosure,
            ws.CloseStatusDescription ?? string.Empty
        );
    }

    public async Task OnMessageAsync(Connection connection, Message message)
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
            await connection.SendAsync(message, CancellationToken);
        }
    }

    public void OnError(Connection connection, string error)
    {
        Log.ErrorReadMessage(_logger, connection.Id, error);
    }
}