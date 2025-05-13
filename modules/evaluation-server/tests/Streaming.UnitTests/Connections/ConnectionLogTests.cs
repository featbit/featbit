using Microsoft.Extensions.Logging.Testing;
using Moq;
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

        var contextMock = new Mock<WebsocketConnectionContext>();
        contextMock
            .Setup(x => x.Type)
            .Returns(connection.Type);
        contextMock
            .Setup(x => x.Connection)
            .Returns(connection);

        manager.Add(contextMock.Object);

        var latestRecord = logger.LatestRecord;

        Assert.Equal("Connection added", latestRecord.Message);

        var expectedProperties = new Dictionary<string, object?>
        {
            ["{OriginalFormat}"] = "Connection added",
            ["connection.Id"] = connection.Id,
            ["connection.Type"] = connection.Type,
            ["connection.Version"] = connection.Version,
            ["connection.ConnectAt"] = connection.ConnectAt,
            ["connection.CloseAt"] = connection.CloseAt,
            ["connection.EnvId"] = connection.EnvId,
            ["connection.ProjectKey"] = connection.ProjectKey,
            ["connection.EnvKey"] = connection.EnvKey,
            ["connection.ClientIpAddress"] = connection.ClientIpAddress,
            ["connection.ClientHost"] = connection.ClientHost,
        };

        Assert.Equivalent(expectedProperties, latestRecord.StructuredState);
    }
}