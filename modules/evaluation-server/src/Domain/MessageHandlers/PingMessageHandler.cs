using Domain.Protocol;
using Domain.WebSockets;

namespace Domain.MessageHandlers;

public class PingMessageHandler : IMessageHandler
{
    public string Type => MessageTypes.Ping;

    public async Task HandleAsync(MessageContext ctx)
    {
        var connection = ctx.Connection;
        var token = ctx.CancellationToken;

        await connection.SendAsync(Message.Pong, token);
    }
}