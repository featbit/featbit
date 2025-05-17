using System.Text.Json;
using Streaming.Connections;

namespace Streaming.Messages;

public class MessageContext
{
    public ConnectionContext Connection { get; }

    public JsonElement Data { get; set; }

    public CancellationToken CancellationToken { get; set; }

    public MessageContext(ConnectionContext connection, JsonElement data, CancellationToken cancellationToken)
    {
        Connection = connection;
        Data = data;
        CancellationToken = cancellationToken;
    }
}