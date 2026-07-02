using Streaming.Protocol;

namespace Streaming.Messages;

public class EchoMessageHandler : IMessageHandler
{
    public string Type => MessageTypes.Echo;

    public async Task HandleAsync(MessageContext ctx)
    {
        var connection = ctx.Connection;
        var message = new ServerMessage(MessageTypes.Echo, ctx.Data);
        var token = ctx.CancellationToken;

        await connection.SendAsync(message, token);
    }
}