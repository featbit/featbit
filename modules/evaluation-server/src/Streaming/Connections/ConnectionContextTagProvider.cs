using Domain.Observability;
using Microsoft.Extensions.Logging;

namespace Streaming.Connections;

internal static class ConnectionContextTagProvider
{
    public static void RecordTags(ITagCollector collector, ConnectionContext context)
    {
        collector.Add("type", context.Type);

        // The SDK token is a credential. Hashed rather than dropped, so "is this the same caller?"
        // — the question an abuse or outage investigation turns on — is still answerable
        // (docs/observability/index.md §7).
        collector.Add("token", Redaction.Token(context.Token));

        collector.Add("version", context.Version);

        collector.Add("connect.at", context.ConnectAt);
        collector.Add("closed.at", context.ClosedAt);

        if (context.Client is not null)
        {
            collector.Add("client.ip", context.Client.IpAddress);
            collector.Add("client.host", context.Client.Host);
        }

        if (context.Type == ConnectionType.RelayProxy)
        {
            var connections = string.Join(
                ",",
                context.MappedRpConnections.Select(x => $"{x.ProjectKey}:{x.EnvKey}")
            );

            collector.Add("rp.connections", connections);
        }
        else
        {
            var connection = context.Connection;

            // Identifies the socket, so every record for one connection can be pulled together.
            // Without it, a connection's lifecycle events cannot be distinguished from any other
            // connection in the same environment.
            //
            // The local name is "id", not CorrelationFields.ConnectionId: every consumer of this
            // provider names its parameter "connection", and the source generator prefixes tags with
            // the parameter name. So "id" is emitted as "connection.id" — which is precisely
            // CorrelationFields.ConnectionId. Using the constant here would stutter to
            // "connection.connection.id". The ConnectionIdTagName assertion in
            // ConnectionContextTagProviderTests pins that relationship.
            collector.Add("id", connection.Id);

            collector.Add("project.key", connection.ProjectKey);
            collector.Add("env.id", connection.EnvId);
            collector.Add("env.key", connection.EnvKey);
        }
    }
}