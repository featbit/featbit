using Streaming.Protocol;
using Streaming.Services;

namespace Streaming.Messages;

public class RpAgentStatusMessageHandler(IRelayProxyService rpService) : IMessageHandler
{
    public string Type => MessageTypes.RpAgentStatus;

    public async Task HandleAsync(MessageContext ctx)
    {
        var agentId = ctx.Data.GetProperty("agentId").GetString()!;
        var status = ctx.Data.GetProperty("status").GetString()!;

        await rpService.UpdateAgentStatusAsync(ctx.Connection.Token, agentId, status);
    }
}