using System.Text.Json;
using Streaming.Connections;

namespace Streaming.Messages;

public class MessageContext
{
    public Connection Connection { get; set; }

    public JsonElement Data { get; set; }

    public CancellationToken CancellationToken { get; set; }

    public MessageContext(Connection connection, JsonElement data, CancellationToken cancellationToken)
    {
        Connection = connection;
        Data = data;
        CancellationToken = cancellationToken;
    }
}