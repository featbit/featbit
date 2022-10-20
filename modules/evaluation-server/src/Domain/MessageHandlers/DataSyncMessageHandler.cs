using System.Text.Json;
using Domain.Core;
using Domain.Protocol;
using Domain.WebSockets;

namespace Domain.MessageHandlers;

public class DataSyncMessageHandler : IMessageHandler
{
    public string Type => MessageTypes.DataSync;

    private readonly IMessageProducer _producer;

    public DataSyncMessageHandler(IMessageProducer producer)
    {
        _producer = producer;
    }

    public async Task HandleAsync(MessageContext ctx)
    {
        var connection = ctx.Connection;

        var message = ctx.Data.Deserialize<DataSyncMessage>(ReusableJsonSerializerOptions.Web);
        if (message == null)
        {
            return;
        }

        // handle client sdk prerequisites
        if (connection.Type == ConnectionType.Client)
        {
            // client sdk must attach user info when sync data
            if (message.User == null || !message.User.IsValid())
            {
                throw new ArgumentException($"client sdk must attach valid user info when sync data.");
            }

            // publish end-user message
            var endUserMessage = new EndUserMessage(connection.EnvId, message.User);
            await _producer.PublishAsync(MessageTopics.EndUser, endUserMessage);
        }
    }
}