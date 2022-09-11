using System.Net.WebSockets;
using Microsoft.Extensions.Logging;

namespace Domain.WebSockets;

public partial class ConnectionManager
{
    private readonly ConnectionStore _connectionStore = new();

    private readonly ILogger<ConnectionManager> _logger;
    public ConnectionManager(ILogger<ConnectionManager> logger)
    {
        _logger = logger;
    }

    public void Register(Connection connection)
    {
        _connectionStore.Add(connection);
        
        Log.ConnectionRegistered(_logger, connection.Id, connection.ToString());
    }

    public async Task RemoveAsync(Connection connection, WebSocketCloseStatus status, string description)
    {
        var closeAt = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        await connection.CloseAsync(status, description, closeAt);

        _connectionStore.Remove(connection);
        
        Log.ConnectionRemoved(_logger, connection.Id);
    }
}