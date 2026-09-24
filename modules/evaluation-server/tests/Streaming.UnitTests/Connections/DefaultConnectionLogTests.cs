using Domain.Observability;
using Domain.Shared;
using Microsoft.Extensions.Logging.Testing;
using Streaming.Connections;
using Streaming.UnitTests.Builders;

namespace Streaming.UnitTests.Connections;

public class ConnectionLogTests
{
    [Fact]
    public void Add_ClientConnection_LogsAllConnectionProperties()
    {
        var logger = new FakeLogger<DefaultConnectionManager>();
        var manager = new DefaultConnectionManager(logger);

        var context = new ConnectionContextBuilder().Build();
        manager.Add(context);

        var latestRecord = logger.LatestRecord;

        Assert.Equal("Connection added", latestRecord.Message);

        var expectedProperties = new Dictionary<string, string?>
        {
            ["{OriginalFormat}"] = "Connection added",

            ["connection.type"] = context.Type,
            // The SDK token is a credential and is logged only in hashed form
            // (docs/observability/index.md §7). Asserting against Redaction rather than a literal
            // means reinstating a raw value fails here. The client IP is deliberately raw: it is
            // operator-facing diagnostic data, not a credential.
            ["connection.token"] = Redaction.Token(context.Token),
            ["connection.version"] = context.Version,

            ["connection.connect.at"] = context.ConnectAt.ToString(),
            ["connection.closed.at"] = context.ClosedAt.ToString(),

            ["connection.client.ip"] = context.Client?.IpAddress,
            ["connection.client.host"] = context.Client?.Host,

            ["connection.id"] = context.Connection.Id,
            ["connection.project.key"] = context.Connection.ProjectKey,
            ["connection.env.id"] = context.Connection.EnvId.ToString(),
            ["connection.env.key"] = context.Connection.EnvKey
        };

        Assert.Equivalent(expectedProperties, latestRecord.StructuredState, strict: true);
    }

    [Fact]
    public void Add_RelayProxyConnection_LogsRelayProxyConnectionsProperty()
    {
        var logger = new FakeLogger<DefaultConnectionManager>();
        var manager = new DefaultConnectionManager(logger);

        Secret[] secrets =
        [
            new(SecretTypes.Server, "p1", Guid.NewGuid(), "prod"),
            new(SecretTypes.Server, "p2", Guid.NewGuid(), "prod"),
        ];

        var context = new ConnectionContextBuilder()
            .WithType(ConnectionType.RelayProxy)
            .WithServerSecrets(secrets)
            .Build();

        manager.Add(context);

        var latestRecord = logger.LatestRecord;

        Assert.Equal("Connection added", latestRecord.Message);

        var expectedProperties = new Dictionary<string, object?>
        {
            ["{OriginalFormat}"] = "Connection added",

            ["connection.type"] = context.Type,
            ["connection.token"] = Redaction.Token(context.Token),
            ["connection.version"] = context.Version,

            ["connection.connect.at"] = context.ConnectAt,
            ["connection.closed.at"] = context.ClosedAt,

            ["connection.client.ip"] = context.Client?.IpAddress,
            ["connection.client.host"] = context.Client?.Host,

            ["connection.rp.connections"] = "p1:prod,p2:prod"
        };

        Assert.Equivalent(expectedProperties, latestRecord.StructuredState, strict: true);
    }
}