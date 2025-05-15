using Microsoft.Extensions.Logging;

namespace Streaming.Connections;

internal static class ConnectionContextTagProvider
{
    public static void RecordTags(ITagCollector collector, ConnectionContext context)
    {
        collector.Add("type", context.Type);
        collector.Add("token", context.Token);
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

            collector.Add("project.key", connection.ProjectKey);
            collector.Add("env.id", connection.EnvId);
            collector.Add("env.key", connection.EnvKey);
        }
    }
}