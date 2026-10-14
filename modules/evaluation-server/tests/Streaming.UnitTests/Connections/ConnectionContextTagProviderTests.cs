using Domain.Observability;
using Microsoft.Extensions.Logging.Testing;
using Streaming.Connections;
using Streaming.UnitTests.Builders;

namespace Streaming.UnitTests.Connections;

/// <summary>
/// Pins the connection-identifier tag emitted for every streaming log record.
/// </summary>
public class ConnectionContextTagProviderTests
{
    [Fact]
    public void Record_ForAnSdkConnection_EmitsTheConnectionIdUnderTheCanonicalFieldName()
    {
        // The provider adds the tag as "id", relying on the source generator prefixing it with the
        // parameter name "connection". That indirection is easy to break by renaming a parameter, so
        // assert the name operators actually query — CorrelationFields.ConnectionId — rather than the
        // name the provider passes in.
        var logger = new FakeLogger<DefaultConnectionManager>();
        var manager = new DefaultConnectionManager(logger);

        var context = new ConnectionContextBuilder().Build();
        manager.Add(context);

        var state = logger.LatestRecord.StructuredState;

        Assert.NotNull(state);
        var tag = Assert.Single(state!, x => x.Key == CorrelationFields.ConnectionId);
        Assert.Equal(context.Connection.Id, tag.Value);
    }

    [Fact]
    public void Record_ForARelayProxyConnection_EmitsNoConnectionId()
    {
        // A relay-proxy context multiplexes several environments over one socket, so there is no
        // single connection to identify; it reports its mapped connections instead.
        var logger = new FakeLogger<DefaultConnectionManager>();
        var manager = new DefaultConnectionManager(logger);

        var context = new ConnectionContextBuilder()
            .WithType(ConnectionType.RelayProxy)
            .Build();
        manager.Add(context);

        var state = logger.LatestRecord.StructuredState;

        Assert.NotNull(state);
        Assert.DoesNotContain(state!, x => x.Key == CorrelationFields.ConnectionId);
    }
}
