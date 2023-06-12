using System.Text.Json;
using Domain.EndUsers;
using Domain.Messages;
using Domain.Shared;
using Streaming.Connections;
using Streaming.Protocol;
using Streaming.Services;

namespace Streaming.Messages;

public class DataSyncMessageHandler : IMessageHandler
{
    public string Type => MessageTypes.DataSync;

    private readonly IMessageProducer _producer;
    private readonly IDataSyncService _service;

    public DataSyncMessageHandler(IMessageProducer producer, IDataSyncService service)
    {
        _producer = producer;
        _service = service;
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
                throw new ArgumentException("client sdk must attach valid user info when sync data.");
            }

            // publish end-user message
            var endUserMessage = new EndUserMessage(connection.EnvId, message.User);
            await _producer.PublishAsync(Topics.EndUser, endUserMessage);
        }

        var payload = await _service.GetPayloadAsync(connection, message);
        var serverMessage = new ServerMessage(MessageTypes.DataSync, payload);
        await connection.SendAsync(serverMessage, ctx.CancellationToken);
    }
}