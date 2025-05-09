using Microsoft.Extensions.Logging.Testing;
using Streaming.Connections;

namespace Streaming.UnitTests.Connections;

public class ConnectionLogTests
{
    [Fact]
    public void LogConnectionProperties()
    {
        var logger = new FakeLogger<ConnectionManager>();
        var manager = new ConnectionManager(logger);

        var connection = new ConnectionBuilder().Build();
        manager.Add(connection);

        var expectedProperties = new Dictionary<string, string?>
        {
            ["{OriginalFormat}"] = "Connection added",
            ["connection.Id"] = connection.Id,
            ["connection.ProjectKey"] = connection.ProjectKey,
            ["connection.EnvKey"] = connection.EnvKey,
            ["connection.ClientIpAddress"] = connection.ClientIpAddress,
            ["connection.ClientHost"] = connection.ClientHost,
        };

        var latestRecord = logger.LatestRecord;

        Assert.Equal("Connection added", latestRecord.Message);
        Assert.Equivalent(expectedProperties, latestRecord.StructuredState);
    }
}