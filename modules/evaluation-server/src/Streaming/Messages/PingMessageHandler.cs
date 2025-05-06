using Streaming.Protocol;

namespace Streaming.Messages;

public class PingMessageHandler : IMessageHandler
{
    private static readonly ReadOnlyMemory<byte> PongMessage = "{\"messageType\":\"pong\",\"data\":{}}"u8.ToArray();

    public string Type => MessageTypes.Ping;

    public async Task HandleAsync(MessageContext ctx)
    {
        var connection = ctx.Connection;
        var token = ctx.CancellationToken;

        await connection.SendAsync(PongMessage, token);
    }
}