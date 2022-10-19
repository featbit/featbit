using Domain.Protocol;

namespace Domain.MessageHandlers;

public class DataSyncMessageHandler : IMessageHandler
{
    public string Type => MessageTypes.DataSync;

    public async Task HandleAsync(MessageContext ctx)
    {
    }
}