using Streaming.Connections;
using Microsoft.Extensions.Logging;
using TestBase;

namespace Streaming.UnitTests.Connections;

public class ConnectionManagerTests
{
    private readonly InMemoryFakeLogger<ConnectionManager> _logger = new();

    [Fact]
    public void AddAndRemove()
    {
        var manager = new ConnectionManager(_logger);

        var connection = new ConnectionBuilder().Build();

        // add connection
        manager.Add(connection);
        Assert.Equal(LogLevel.Trace, _logger.Level);
        Assert.Null(_logger.Ex);
        Assert.Equal($"{connection.Id}: connection added.", _logger.Message);

        // remove connection
        manager.Remove(connection);
        Assert.Equal(LogLevel.Trace, _logger.Level);
        Assert.Null(_logger.Ex);
        Assert.Equal($"{connection.Id}: connection removed.", _logger.Message);
    }
}