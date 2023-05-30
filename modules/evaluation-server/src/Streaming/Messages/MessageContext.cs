using System.Text.Json;
using Streaming.Connections;

namespace Streaming.Messages;

public class MessageContext
{
    public Connection Connection { get; set; }

    public Message Message { get; set; }

    public JsonElement Data { get; set; }

    public CancellationToken CancellationToken { get; set; }

    public MessageContext(Connection connection, Message message, JsonElement data, CancellationToken cancellationToken)
    {
        Connection = connection;
        Message = message;
        Data = data;
        CancellationToken = cancellationToken;
    }
}