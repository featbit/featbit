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

    public static Client Empty => new(string.Empty, string.Empty);
}