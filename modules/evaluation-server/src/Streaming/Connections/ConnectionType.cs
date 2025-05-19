namespace Streaming.Connections;

public static class ConnectionType
{
    public const string Server = "server";
    public const string Client = "client";
    public const string RelayProxy = "relay-proxy";

    public static readonly string[] All = [Server, Client, RelayProxy];
}