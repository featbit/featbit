using Domain.Shared;
using Microsoft.Extensions.Logging.Testing;
using Streaming.Connections;

namespace Streaming.UnitTests.Connections;

public class ConnectionLogTests
{
    [Fact]
    public void ClientConnectionProperties()
    {
        var logger = new FakeLogger<ConnectionManager>();
        var manager = new ConnectionManager(logger);

        var context = new ConnectionContextBuilder().Build();
        manager.Add(context);

        var latestRecord = logger.LatestRecord;

        Assert.Equal("Connection added", latestRecord.Message);

        var expectedProperties = new Dictionary<string, string?>
        {
            ["{OriginalFormat}"] = "Connection added",

            ["connection.type"] = context.Type,
            ["connection.token"] = context.Token,
            ["connection.version"] = context.Version,

            ["connection.connect.at"] = context.ConnectAt.ToString(),
            ["connection.closed.at"] = context.ClosedAt.ToString(),

            ["connection.client.ip"] = context.Client?.IpAddress,
            ["connection.client.host"] = context.Client?.Host,

            ["connection.project.key"] = context.Connection.ProjectKey,
            ["connection.env.id"] = context.Connection.EnvId.ToString(),
            ["connection.env.key"] = context.Connection.EnvKey
        };

        Assert.Equivalent(latestRecord.StructuredState, expectedProperties);
    }

    [Fact]
    public void RelayProxyConnectionProperties()
    {
        var logger = new FakeLogger<ConnectionManager>();
        var manager = new ConnectionManager(logger);

        Secret[] secrets =
        [
            new(ConnectionType.Client, "p1", Guid.NewGuid(), "dev"),
            new(ConnectionType.Server, "p1", Guid.NewGuid(), "prod"),
        ];

        var context = new ConnectionContextBuilder()
            .WithType(ConnectionType.RelayProxy)
            .WithSecrets(secrets)
            .Build();

        manager.Add(context);

        var latestRecord = logger.LatestRecord;

        Assert.Equal("Connection added", latestRecord.Message);

        var expectedProperties = new Dictionary<string, object?>
        {
            ["{OriginalFormat}"] = "Connection added",

            ["connection.type"] = context.Type,
            ["connection.token"] = context.Token,
            ["connection.version"] = context.Version,

            ["connection.connect.at"] = context.ConnectAt,
            ["connection.closed.at"] = context.ClosedAt,

            ["connection.client.ip"] = context.Client?.IpAddress,
            ["connection.client.host"] = context.Client?.Host,

            ["connection.rp.connections"] = "p1:dev,p1:prod"
        };

        Assert.Equivalent(latestRecord.StructuredState, expectedProperties);
    }
}