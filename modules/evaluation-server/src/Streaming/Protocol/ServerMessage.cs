using System.Text;
using System.Text.Json;
using Domain.Shared;

namespace Streaming.Protocol;

public class ServerMessage
{
    public string MessageType { get; protected set; }

    public object Data { get; protected set; }

    public ServerMessage(string messageType, object data)
    {
        MessageType = messageType;
        Data = data;
    }

    public byte[] GetBytes()
    {
        var json = JsonSerializer.Serialize(this, ReusableJsonSerializerOptions.Web);

        return Encoding.UTF8.GetBytes(json);
    }
}