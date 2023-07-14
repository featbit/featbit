using Microsoft.Extensions.Logging;

namespace Streaming.Connections;

public partial class ConnectionManager : IConnectionManager
{
    private readonly ConnectionStore _connectionStore = new();
    private readonly ILogger<ConnectionManager> _logger;

    public ConnectionManager(ILogger<ConnectionManager> logger)
    {
        _logger = logger;
    }

    public void Add(Connection connection)
    {
        _connectionStore.Add(connection);

        Log.ConnectionAdded(_logger, connection.Id, connection.ToString());
    }

    public void Remove(Connection connection)
    {
        _connectionStore.Remove(connection);

        Log.ConnectionRemoved(_logger, connection.Id);
    }

    public ICollection<Connection> GetEnvConnections(Guid envId)
    {
        return _connectionStore.Find(x => x.EnvId == envId);
    }
}