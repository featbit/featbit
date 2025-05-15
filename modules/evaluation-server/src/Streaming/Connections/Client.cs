namespace Streaming.Connections;

public class Client
{
    public string IpAddress { get; }

    public string Host { get; }

    public Client(string ipAddress, string host)
    {
        IpAddress = ipAddress;
        Host = host;
    }
}