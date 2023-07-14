namespace Streaming.Connections;

public class ConnectionType
{
    public const string Server = "server";
    public const string Client = "client";

    public static readonly string[] All = { Server, Client };

    public static bool IsRegistered(string sdkType) => All.Contains(sdkType);
}